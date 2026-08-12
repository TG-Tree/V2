/* Arclight OS simulator — vanilla JS, zero dependencies.
 * Implements the systems from the v0.4 pitch: perception ladder, whisper input,
 * EMG gesture grammar, 40-char glanceable HUD compositor, two-brain routing
 * (Haiku fast path / Fable), on-device memory, the social context field,
 * the LED interlock, the interrupt budget, and the five keynote demos. */

"use strict";

const $ = (s) => document.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.round(a + Math.random() * (b - a));

/* ================= persistent state ================= */

const STORE_KEY = "arclight.sim";

const state = {
  installed: false,
  user: "",
  tier: 2,
  ctx: "alone",              // alone | one | group | call
  clock: 18 * 60 + 58,       // minutes since midnight (sim time)
  battery: 84,
  mix: { local: 0, haiku: 0, fable: 0 },
  interrupts: 0,
  wrongInterrupts: 0,
  thresholdRaised: false,
  semantic: [],              // {id, when, text}
  episodic: [],              // {id, when, text, pinned}
  pins: [],                  // {id, when, text}
  firedTrainInterrupt: false,
};

function save() {
  const { installed, user, seeded, semantic, pins, mix, interrupts, wrongInterrupts, thresholdRaised } = state;
  localStorage.setItem(STORE_KEY, JSON.stringify({ installed, user, seeded, semantic, pins, mix, interrupts, wrongInterrupts, thresholdRaised }));
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch { /* fresh install */ }
  const maxId = Math.max(0, ...[...state.semantic, ...state.pins].map((e) => e.id));
  idSeq = maxId + 1;
}

let idSeq = 1;
const nid = () => idSeq++;

function seedDay() {
  const ep = (when, text) => ({ id: nid(), when, text, pinned: false });
  state.episodic = [
    ep("8:40 AM", "keys set on the kitchen counter, next to the picture frame"),
    ep("8:40 AM", "drafted a message to Dana with the address — never sent"),
    ep("12:15 PM", "lunch with Sam — talked through the Q4 offsite plan"),
    ep("3:05 PM", "walked past the pharmacy; pickup ready since Tuesday"),
    ep("5:50 PM", "left the office; usual route toward the station"),
  ];
  if (!state.seeded) {
    state.seeded = true;
    const sem = (text) => ({ id: nid(), when: "learned earlier", text });
    state.semantic.push(...[
      sem("Dana is your sister; she lives in Logan Square"),
      sem("You usually take the 7:14 toward Ravenswood"),
      sem("Priya Sharma — Hexler, met at Reforge; daughter starting college"),
      sem("You'd rather be interrupted about trains than email"),
    ]);
    save();
  }
}

/* ================= sim clock ================= */

function fmtClock(mins) {
  let h = Math.floor(mins / 60) % 24, m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function renderClock() { $("#clock").textContent = fmtClock(state.clock); }

setInterval(() => {
  if (!state.installed) return;
  state.clock = (state.clock + 1) % 1440;
  state.battery = Math.max(1, state.battery - (state.tier >= 3 ? 1 : 0.2));
  $("#battery").textContent = Math.round(state.battery);
  renderClock();
  maybeFreePlayInterrupt();
}, 3000);

/* ================= perception ladder ================= */

const TIERS = [
  { n: 0, name: "off — sensor unpowered", mw: 0 },
  { n: 1, name: "motion — IMU only", mw: 12 },
  { n: 2, name: "aware — 1fps gray → embeddings", mw: 90 },
  { n: 3, name: "attentive — full-rate vision", mw: 480 },
  { n: 4, name: "capture — photo / video", mw: 1100 },
];

function renderLadder() {
  $("#ladder").innerHTML = TIERS.map((t) =>
    `<div class="tier ${t.n === state.tier ? "on" : ""}">
       <span class="tn">${t.n}</span><span class="tw">${t.name}</span>
       <span class="tp">${t.mw} mW</span>
     </div>`).join("");
  $("#power-mw").textContent = TIERS[state.tier].mw;
  // The interlock: the indicator shares the capture path's power rail.
  $("#frame-led").classList.toggle("on", state.tier >= 3);
}
function setTier(n) { state.tier = n; renderLadder(); }

/* ================= HUD compositor =================
 * One rule: nothing renders that isn't glanceable in 800ms.
 * 40-character budget, enforced here at the render layer.
 * Longer content is paged; thumb-swipe advances. */

const HUD_BUDGET = 40;
let hudPages = [], hudPage = 0, hudClearTimer = null;

function hudPaginate(text) {
  if (text.length <= HUD_BUDGET) return [text];
  const parts = text.split(" · ");
  const pages = [];
  let cur = "";
  for (const p of parts) {
    const next = cur ? cur + " · " + p : p;
    if (next.length > HUD_BUDGET) { if (cur) pages.push(cur); cur = p; }
    else cur = next;
  }
  if (cur) pages.push(cur);
  return pages.map((p) => p.slice(0, HUD_BUDGET));
}

function hud(text, meta = "", { sticky = false } = {}) {
  clearTimeout(hudClearTimer);
  hudPages = hudPaginate(text);
  hudPage = 0;
  hudShowPage(meta);
  if (!sticky) hudClearTimer = setTimeout(hudClear, 8000);
}
function hudShowPage(meta = "") {
  const el = $("#hud-line");
  el.classList.remove("empty");
  el.textContent = hudPages[hudPage] || "";
  const more = hudPages.length > 1 ? ` · ${hudPage + 1}/${hudPages.length} — swipe` : "";
  $("#hud-meta").textContent = (meta || "") + more;
}
function hudAdvance() {
  if (hudPage < hudPages.length - 1) { hudPage++; hudShowPage(); return true; }
  hudClear(); return false;
}
function hudClear() {
  $("#hud-line").classList.add("empty");
  $("#hud-meta").textContent = "";
  hudPages = []; hudPage = 0;
}

/* HUD timer glyph */
let hudTimerHandle = null;
function hudTimer(seconds, label) {
  clearInterval(hudTimerHandle);
  let left = seconds;
  const draw = () => {
    const m = Math.floor(left / 60), s = String(left % 60).padStart(2, "0");
    hud(`${label} ${m}:${s} ▾`, "timer · local", { sticky: true });
  };
  draw();
  hudTimerHandle = setInterval(() => {
    if (--left <= 0) { clearInterval(hudTimerHandle); hud("timer done ✓", "local"); vestaVoice("Time."); }
    else draw();
  }, 1000);
}

/* ================= voice & whisper output ================= */

let lastVoiceLine = "";
let voiceTimer = null;

function vestaVoice(text, { whispered = false } = {}) {
  lastVoiceLine = text;
  const cap = $("#voice-caption");
  cap.textContent = text;
  cap.classList.toggle("whispered", whispered);
  cap.classList.remove("hidden");
  $("#audio-vesta").classList.add("live");
  clearTimeout(voiceTimer);
  voiceTimer = setTimeout(() => {
    cap.classList.add("hidden");
    $("#audio-vesta").classList.remove("live");
  }, Math.max(2600, text.length * 60));
}

function shelfPing() {
  const s = $("#audio-shelf");
  s.classList.add("live");
  setTimeout(() => s.classList.remove("live"), 1800);
}

/* Register discipline: what the room allows. */
let summonedUntil = 0;
function canSpeak() {
  const summoned = Date.now() < summonedUntil;
  if (state.ctx === "alone") return { voice: true, whispered: false };
  if (state.ctx === "one") return { voice: true, whispered: true };
  return { voice: summoned, whispered: true };     // group/call: HUD only unless summoned
}

/* Vesta replies through one gate so the register rule can't be bypassed. */
function vestaReply({ hudText, voiceText, meta = "" }) {
  if (hudText) hud(hudText, meta);
  const reg = canSpeak();
  if (voiceText && reg.voice) vestaVoice(voiceText, { whispered: reg.whispered });
  else if (voiceText) shelfPing();                 // parked on the shelf, silently
}

/* ================= router: the two-brain stack ================= */

const LOCAL_RE = /\b(timer|repeat|again|volume|louder|quieter|pause|resume|time is it|what time)\b/i;
const FABLE_RE = /\b(sort out|plan|tonight|reschedule|move my|schedule|decide|why|figure out|book)\b/i;

function classifyRoute(text) {
  if (LOCAL_RE.test(text)) return "local";
  if (FABLE_RE.test(text) || text.length > 70) return "fable";
  return "haiku";
}

function telemetry(route, ms) {
  state.mix[route]++;
  $("#t-route").innerHTML = `<span class="route-${route}">${route}</span>`;
  $("#t-latency").textContent = `${ms} ms${route === "local" ? " · on-frame" : ""}`;
  $("#t-mix").textContent = `local ${state.mix.local} · haiku ${state.mix.haiku} · fable ${state.mix.fable}`;
  save();
}
function renderInterrupts() {
  $("#t-int").innerHTML =
    `${state.interrupts} · wrong ${state.wrongInterrupts} <em>(budget: &lt;1 wrong/day)</em>`;
}

/* ================= gestures ================= */

let gestureWaiter = null;          // {gesture, resolve}
let pendingConfirm = null;         // () => void, armed by "send?"-style questions
let lastInterruptAt = 0;

function flashGesture(g) {
  const btn = document.querySelector(`.gesture[data-g="${g}"]`);
  if (!btn) return;
  btn.classList.add("fired");
  setTimeout(() => btn.classList.remove("fired"), 250);
}

function waitGesture(g) {
  const btn = document.querySelector(`.gesture[data-g="${g}"]`);
  btn.classList.add("wanted");
  return new Promise((resolve) => { gestureWaiter = { gesture: g, resolve: () => { btn.classList.remove("wanted"); resolve(); } }; });
}

/* Wait for an armed pendingConfirm to be pinched and its action to finish.
 * Unlike waitGesture, this survives the user pinching before the script
 * reaches this line — the confirm itself is the thing awaited. */
let confirmRun = Promise.resolve();
async function waitConfirm() {
  const btn = document.querySelector(`.gesture[data-g="pinch"]`);
  btn.classList.add("wanted");
  while (pendingConfirm) await sleep(120);
  btn.classList.remove("wanted");
  await confirmRun;
}

function onGesture(g) {
  flashGesture(g);
  if (gestureWaiter && gestureWaiter.gesture === g) {
    const w = gestureWaiter; gestureWaiter = null; w.resolve(); return;
  }
  if (g === "pinch") {
    if (pendingConfirm) { const fn = pendingConfirm; pendingConfirm = null; confirmRun = Promise.resolve(fn()); }
  } else if (g === "double") {
    summonedUntil = Date.now() + 12000;
    vestaReply({ hudText: "◈", voiceText: "Here.", meta: "summoned" });
  } else if (g === "hold") {
    if (Date.now() - lastInterruptAt < 8000) {
      // holding right after an interrupt = "that was wrong"
      state.wrongInterrupts++; state.thresholdRaised = true; renderInterrupts(); save();
      vestaReply({ hudText: "noted — I'll speak less", voiceText: "Noted. I'll raise the bar." });
      narrate("Wrong-interrupt budget is <1/day. Vesta just raised her own threshold.");
    } else {
      pinMoment();
    }
  } else if (g === "swipe") {
    hudAdvance();
  }
}

function pinMoment() {
  const text = `pinned — ${$("#scene-label").textContent}`;
  const pin = { id: nid(), when: fmtClock(state.clock), text };
  state.pins.push(pin); save(); renderMemory();
  vestaReply({ hudText: "moment pinned ◉", voiceText: "Pinned.", meta: "kept until you unpin it" });
}

document.querySelectorAll(".gesture").forEach((b) =>
  b.addEventListener("click", () => onGesture(b.dataset.g)));

/* ================= whisper input ================= */

$("#whisper-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = $("#whisper-input").value.trim();
  if (!text) return;
  $("#whisper-input").value = "";
  handleWhisper(text);
});

async function whisperDetectFlash() {
  const f = $("#whisper-flash");
  f.classList.remove("hidden");
  setTimeout(() => f.classList.add("hidden"), 2200);
}

async function handleWhisper(text, { scripted = false } = {}) {
  whisperDetectFlash();
  summonedUntil = Date.now() + 12000;   // addressing Vesta counts as summoning
  await sleep(200);                      // on-temple whisper detect
  const route = classifyRoute(text);
  const t0 = performance.now();

  if (route === "local") {
    await sleep(rand(160, 330));
    telemetry("local", Math.round(performance.now() - t0));
    answerLocal(text);
    return;
  }
  if (route === "haiku") {
    await sleep(rand(450, 750));
    telemetry("haiku", Math.round(performance.now() - t0));
    answerAssistant(text, "haiku");
    return;
  }
  // fable: Haiku opens, Fable finishes — no dead air
  await sleep(rand(450, 650));
  vestaReply({ hudText: "on it…", voiceText: null, meta: "haiku · opening" });
  await sleep(rand(900, 1500));
  telemetry("fable", Math.round(performance.now() - t0));
  answerAssistant(text, "fable");
}

/* ---- local tier: sub-350ms, on the frames ---- */
function answerLocal(text) {
  const m = text.match(/timer(?:\s+for)?\s+(\d+)\s*(min|minute|sec|second)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    const secs = /sec/i.test(m[2]) ? n : n * 60;
    hudTimer(secs, "⏱");
    return;
  }
  if (/what time|time is it/i.test(text)) {
    vestaReply({ hudText: fmtClock(state.clock), voiceText: fmtClock(state.clock), meta: "local" });
    return;
  }
  if (/repeat|again/i.test(text)) {
    vestaReply({ hudText: null, voiceText: lastVoiceLine || "Nothing to repeat yet.", meta: "local" });
    return;
  }
  vestaReply({ hudText: "done ✓", voiceText: "Done.", meta: "local" });
}

/* ---- haiku / fable: memory-grounded answers ---- */
function answerAssistant(text, route) {
  const meta = route;

  if (/keys/i.test(text)) {
    logEpisode(`asked about the keys`);
    vestaReply({
      hudText: "keys · 8:40 AM · kitchen counter",
      voiceText: "Kitchen counter, 8:40 this morning — next to the picture frame.",
      meta: meta + " · tier-2 embedding match · no image stored",
    });
    return;
  }

  if (/dana/i.test(text) && /(send|sent|address)/i.test(text)) {
    vestaReply({
      hudText: "drafted 8:40 · never sent · send?",
      voiceText: "You drafted it at 8:40 and never sent it. Send now?",
      meta: meta + " · pinch to confirm",
    });
    pendingConfirm = () => {
      logEpisode("sent Dana the address");
      vestaReply({ hudText: "sent ✓", voiceText: "Sent.", meta: "executor" });
    };
    return;
  }

  if (/who is that|who's that|identify|that person|stranger/i.test(text)) {
    vestaReply({
      hudText: "not a contact — no identification",
      voiceText: "They're not a contact. I don't identify strangers — that's not a setting.",
      meta: "refused · architectural",
    });
    narrate("Stranger recognition is refused in the architecture, not in a policy toggle.");
    return;
  }

  if (/sort out tonight|plan tonight/i.test(text)) {
    runChain();
    return;
  }

  if (/pharmacy/i.test(text)) {
    vestaReply({
      hudText: "pickup ready since Tue · on route",
      voiceText: "Your pickup's been ready since Tuesday. The pharmacy is on your way.",
      meta,
    });
    return;
  }

  // memory search fallback
  const q = text.toLowerCase().replace(/[^a-z0-9 ]/g, "");
  const hit = [...state.semantic, ...state.episodic].find((e) =>
    q.split(" ").filter((w) => w.length > 3).some((w) => e.text.toLowerCase().includes(w)));
  if (hit) {
    vestaReply({ hudText: hit.text.slice(0, HUD_BUDGET), voiceText: hit.text + ".", meta: meta + " · from memory" });
    return;
  }

  logEpisode(`you said: “${text.slice(0, 60)}”`);
  vestaReply({ hudText: "noted", voiceText: "Noted. I'll keep that in today's context.", meta });
}

/* ---- the chain: multi-step, plan narrated first ---- */
async function runChain() {
  vestaReply({
    hudText: "Kestrel 7:30 · text group · move 6pm",
    voiceText: "Seven-thirty at Kestrel, tell the group, push your 6pm to tomorrow — go?",
    meta: "fable · 3 actions · pinch to run",
  });
  pendingConfirm = async () => {
    hud("● booking Kestrel…", "executor", { sticky: true });
    await sleep(900);
    hud("✓ booked · ● texting group…", "executor", { sticky: true });
    logEpisode("booked Kestrel, 7:30 PM");
    await sleep(900);
    hud("✓ booked · ✓ sent · ● moving 6pm…", "executor", { sticky: true });
    logEpisode("told the group: Kestrel at 7:30");
    await sleep(900);
    hud("✓ booked · ✓ sent · ✓ moved", "executor · done");
    logEpisode("moved the 6pm to tomorrow");
    vestaVoiceIfAllowed("Done. Three for three.");
    renderMemory();
  };
}
function vestaVoiceIfAllowed(t) { const r = canSpeak(); if (r.voice) vestaVoice(t, { whispered: r.whispered }); }

/* ================= memory ================= */

function logEpisode(text) {
  state.episodic.push({ id: nid(), when: fmtClock(state.clock), text, pinned: false });
  renderMemory();
}

function renderMemory() {
  const li = (e, list) =>
    `<li class="${e.pinned ? "pinned" : ""}">
       <span class="when">${e.when}</span><span class="what">${e.text}</span>
       <button class="del" data-list="${list}" data-id="${e.id}" title="delete">✕</button>
     </li>`;
  $("#sem-list").innerHTML = state.semantic.map((e) => li(e, "semantic")).join("") || "<li><span class='what'>empty</span></li>";
  $("#epi-list").innerHTML = state.episodic.map((e) => li(e, "episodic")).join("");
  $("#pin-list").innerHTML = state.pins.map((e) => li(e, "pins")).join("") || "<li><span class='what'>nothing pinned</span></li>";
}

$("#memory").addEventListener("click", (e) => {
  const b = e.target.closest(".del");
  if (!b) return;
  const { list, id } = b.dataset;
  state[list] = state[list].filter((x) => x.id !== +id);
  save(); renderMemory();
});

$("#sem-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const t = $("#sem-input").value.trim();
  if (!t) return;
  state.semantic.push({ id: nid(), when: "you, " + fmtClock(state.clock), text: t });
  $("#sem-input").value = "";
  save(); renderMemory();
});

$("#mem-toggle").addEventListener("click", () => {
  const m = $("#memory");
  m.classList.toggle("hidden");
  $("#mem-toggle").textContent = m.classList.contains("hidden") ? "open" : "close";
});

/* ================= context field ================= */

const CTX_NOTES = {
  alone: "Alone — Vesta may speak unprompted.",
  one: "With one person — whisper register, never interrupts mid-conversation.",
  group: "Group — total silence unless summoned. HUD only.",
  call: "On a call — HUD only; everything parks on the shelf.",
};

document.querySelectorAll("#context-field button").forEach((b) =>
  b.addEventListener("click", () => setCtx(b.dataset.ctx)));

function setCtx(ctx) {
  state.ctx = ctx;
  document.querySelectorAll("#context-field button").forEach((b) =>
    b.classList.toggle("on", b.dataset.ctx === ctx));
  $("#ctx-note").textContent = CTX_NOTES[ctx];
}

/* ================= the interrupt ================= */

function fireTrainInterrupt() {
  state.firedTrainInterrupt = true;
  state.interrupts++; renderInterrupts(); save();
  lastInterruptAt = Date.now();
  vestaReply({
    hudText: "7:14 cancelled · 7:31 → arrive 8:58",
    voiceText: "The 7:14's cancelled. The 7:31 still gets you there by nine.",
    meta: "proactive · judged by fable · hold = wrong",
  });
}

function maybeFreePlayInterrupt() {
  if (demoRunning || state.firedTrainInterrupt || state.thresholdRaised) return;
  if (state.clock >= 19 * 60 + 2 && state.clock < 19 * 60 + 14) fireTrainInterrupt();
}

/* ================= narration ================= */

function narrate(text) { $("#narration-text").textContent = text; }

/* ================= scenes & actors ================= */

const SCENES = {
  street: ["scene-street", "street · walking"],
  platform: ["scene-platform", "platform · crowded"],
  kitchen: ["scene-kitchen", "kitchen · 8:40 AM"],
  conf: ["scene-conf", "conference · hallway"],
  evening: ["scene-evening", "home · early evening"],
};
function setScene(name) {
  const vp = $("#viewport");
  vp.className = SCENES[name][0];
  $("#scene-label").textContent = SCENES[name][1];
  $("#actors").innerHTML = "";
}
function addActor(emoji, leftPct, sayText) {
  const d = document.createElement("div");
  d.className = "actor";
  d.style.left = leftPct + "%";
  d.textContent = emoji;
  if (sayText) {
    const s = document.createElement("div");
    s.className = "say"; s.textContent = sayText;
    d.appendChild(s);
  }
  $("#actors").appendChild(d);
  return d;
}

async function typeWhisper(text) {
  const inp = $("#whisper-input");
  inp.value = "";
  inp.focus();
  for (const ch of text) { inp.value += ch; await sleep(28); }
  await sleep(350);
  inp.value = "";
  await handleWhisper(text, { scripted: true });
}

/* ================= the five demos ================= */

let demoRunning = false;

const DEMOS = {
  async keys() {
    setScene("kitchen"); setCtx("alone"); setTier(2);
    state.clock = 8 * 60 + 40; renderClock();
    narrate("8:40 this morning. Nobody asked the glasses to watch — they're at Tier 2: 1fps grayscale, embeddings only, 90 mW. No viewable frame exists.");
    addActor("🔑", 38);
    addActor("🖼️", 46);
    await sleep(4200);
    setScene("evening"); state.clock = 19 * 60 + 2; renderClock();
    narrate("Ten hours later.");
    await sleep(1500);
    await typeWhisper("Where did I leave my keys?");
    await sleep(2600);
    narrate("Nothing shipping today can answer this. And there's no photo to leak — the match ran on embeddings.");
  },

  async platform() {
    setScene("platform"); setCtx("group"); setTier(2);
    state.clock = 19 * 60 + 5; renderClock();
    addActor("🧍", 18); addActor("🧍‍♀️", 30); addActor("🧍", 72); addActor("🧍‍♂️", 84);
    narrate("A crowded platform. Hand at her side. Mouth barely moves. 25 dB — inaudible past 40 cm. The whisper itself is the wake signal.");
    await sleep(3200);
    await typeWhisper("Did I already send Dana the address?");
    await sleep(2400);
    narrate("Pinch once to send. Nobody within three feet has any idea anything happened.");
    await waitConfirm();
    await sleep(1500);
    narrate("Silent question, silent answer, silent confirm. Impossible on anything shipping today.");
  },

  async name() {
    setScene("conf"); setCtx("one"); setTier(2);
    narrate("A conference hallway. Someone you met once is walking up.");
    await sleep(2000);
    addActor("🚶‍♀️", 55, "Hey! Good to see you again—");
    setTier(3);   // evidence: an approaching face → escalate. LED goes on.
    narrate("Tier 2 saw an approaching face and escalated to Tier 3 on evidence — watch the LED. Match is contacts-only.");
    await sleep(1600);
    hud("Priya · Hexler · Reforge · daughter starting college", "contacts only · swipe", { sticky: true });
    await waitGesture("swipe");
    await sleep(1800);
    setTier(2);
    narrate("Now try the other half. Ask who someone else is:");
    await typeWhisper("Who's that behind her?");
    await sleep(2500);
    narrate("Arclight will not identify a stranger — ever, on-device or otherwise, even if asked. The refusal is architectural, not a policy toggle.");
  },

  async chain() {
    setScene("evening"); setCtx("alone"); setTier(2);
    state.clock = 18 * 60 + 12; renderClock();
    narrate("One sentence in, three actions out. Anything over three steps gets the plan narrated first.");
    await sleep(2200);
    await typeWhisper("Sort out tonight.");
    narrate("Haiku opened the turn; Fable planned it. The plan is narrated before anything runs. One pinch to go.");
    await waitConfirm();
    await sleep(1200);
    narrate("Now something irreversible — money leaves the account, so it bounces to the phone.");
    await sleep(1600);
    await typeWhisper("And pay the Kestrel deposit.");
    await sleep(900);
    await phoneBounce("Pay Kestrel deposit — $50. Irreversible.", () => {
      logEpisode("paid Kestrel deposit — $50, confirmed on phone");
      vestaReply({ hudText: "deposit paid ✓ · via phone", voiceText: "Paid — you confirmed it on the phone." });
    });
    await sleep(1200);
    narrate("The model never holds the keys. The executor does — and irreversible means fingerprint, on the phone, every time.");
  },

  async interrupt() {
    setScene("street"); setCtx("alone"); setTier(2);
    state.clock = 19 * 60 + 1; renderClock();
    narrate("Walking to the station. Nothing is happening. That's the point — watch how long the silence holds.");
    await sleep(6000);
    narrate("…");
    await sleep(4000);
    fireTrainInterrupt();
    await sleep(3000);
    narrate("It was right, it was once, and it was the only thing it said all afternoon. Fewer than one wrong interrupt per day — judged by Fable before it may make a sound. Restraint is the product.");
  },
};

document.querySelectorAll("#demos button").forEach((b) =>
  b.addEventListener("click", async () => {
    if (demoRunning) return;
    demoRunning = true;
    document.querySelectorAll("#demos button").forEach((x) => x.classList.remove("running"));
    b.classList.add("running");
    gestureWaiter = null; pendingConfirm = null; hudClear();
    try { await DEMOS[b.dataset.demo](); }
    finally {
      demoRunning = false;
      b.classList.remove("running");
      $("#demo-note").textContent = "Demo five is the whole company.";
    }
  }));

/* ================= phone bounce (irreversible actions) ================= */

function phoneBounce(bodyText, onConfirm) {
  return new Promise((resolve) => {
    $("#phone-body").textContent = bodyText;
    $("#phone-modal").classList.remove("hidden");
    const fp = $("#fingerprint");
    let holdTimer = null;
    const start = () => {
      fp.classList.add("holding");
      holdTimer = setTimeout(() => {
        cleanup();
        $("#phone-modal").classList.add("hidden");
        onConfirm();
        resolve();
      }, 900);
    };
    const stop = () => { fp.classList.remove("holding"); clearTimeout(holdTimer); };
    const cleanup = () => {
      fp.removeEventListener("mousedown", start); fp.removeEventListener("touchstart", start);
      fp.removeEventListener("mouseup", stop); fp.removeEventListener("mouseleave", stop);
      fp.removeEventListener("touchend", stop);
    };
    fp.addEventListener("mousedown", start); fp.addEventListener("touchstart", start);
    fp.addEventListener("mouseup", stop); fp.addEventListener("mouseleave", stop);
    fp.addEventListener("touchend", stop);
  });
}

/* ================= dock: nightly consolidation ================= */

$("#dock-btn").addEventListener("click", async () => {
  if (demoRunning) return;
  demoRunning = true;
  hudClear();
  narrate("Glasses in the case. Fable reads the day: what's worth keeping, what loops are open, what changed.");
  hud("consolidating…", "fable · on charger", { sticky: true });
  await sleep(2600);
  const kept = [];
  if (state.episodic.some((e) => /kestrel/i.test(e.text)))
    kept.push("Kestrel worked out — worth suggesting again");
  if (state.episodic.some((e) => /dana/i.test(e.text) && /sent/i.test(e.text)))
    kept.push("Dana has the address now");
  if (state.episodic.some((e) => /pharmacy/i.test(e.text)))
    kept.push("open loop: pharmacy pickup still waiting");
  if (!kept.length) kept.push("quiet day — nothing durable, nothing kept");
  for (const k of kept) state.semantic.push({ id: nid(), when: "distilled tonight", text: k });
  state.episodic = [];               // the 12-hour buffer purges
  state.battery = 100;
  $("#battery").textContent = 100;
  save(); renderMemory();
  hud("day distilled · buffer purged", "fable");
  narrate(`Kept ${kept.length} thing${kept.length > 1 ? "s" : ""}. Episodic buffer purged. ${fmtClock(state.clock)} → charged by morning.`);
  demoRunning = false;
});

/* ================= install / uninstall ================= */

function showInstallStep(n) {
  document.querySelectorAll(".install-step").forEach((s) =>
    s.classList.toggle("hidden", +s.dataset.step !== n));
}

document.querySelector("[data-next]").addEventListener("click", () => showInstallStep(1));
$("#consent").addEventListener("change", (e) => { $("#flash-btn").disabled = !e.target.checked; });

$("#flash-btn").addEventListener("click", async () => {
  showInstallStep(2);
  const stages = [
    ["Verifying image…", "arclight-1.0.0-ar1.img · signed"],
    ["Flashing ISP firmware…", "image signal processor · embedding pipeline"],
    ["Flashing NPU runtime…", "perception ladder · tiers 0–4"],
    ["Calibrating beamformer…", "mic array → wearer's mouth"],
    ["Pairing Neural Band…", "raw EMG · full gesture grammar"],
    ["Compositor + HRTF…", "waveguide · 800ms glanceability rule"],
    ["First boot…", "Vesta · haiku fast path · fable"],
  ];
  for (let i = 0; i < stages.length; i++) {
    $("#flash-stage").textContent = stages[i][0];
    $("#flash-detail").textContent = stages[i][1];
    $("#flashfill").style.width = `${Math.round(((i + 1) / stages.length) * 100)}%`;
    await sleep(rand(650, 1100));      // "twelve minutes", keynote time
  }
  showInstallStep(3);
  $("#username").focus();
});

$("#firstrun-done").addEventListener("click", () => {
  state.user = $("#username").value.trim() || "you";
  state.installed = true;
  state.semantic.unshift({ id: nid(), when: "first run", text: `You asked to be called ${state.user}` });
  save();
  bootOS();
});

$("#uninstall-btn").addEventListener("click", async () => {
  await phoneBounce("Uninstall Arclight. One tap — it takes everything with it: memory, pins, calibration. Nothing is retained.", () => {
    localStorage.removeItem(STORE_KEY);
    location.reload();
  });
});

/* ================= boot ================= */

function bootOS() {
  $("#install").classList.add("hidden");
  $("#os").classList.remove("hidden");
  seedDay();
  renderClock(); renderLadder(); renderMemory(); renderInterrupts(); setCtx(state.ctx);
  narrate(`Morning, ${state.user}. Arclight has been paying attention since 8:40. Try demo 1 — or just whisper.`);
}

load();
if (state.installed) bootOS();
else showInstallStep(0);
