# ◈ ARCLIGHT — OS Simulator

**Same glasses. Different mind.**

A working, zero-dependency simulator of the Arclight operating system from the
[v0.4 pitch](docs/PITCH-v0.4.md) — the OS you download to your glasses. It runs
the whole pitch in a browser: the perception ladder, whisper input, the EMG
gesture grammar, the glanceable HUD compositor, Vesta's two-brain routing,
on-device memory, the social context field, the hardware LED interlock, and
all five keynote demos.

## Run it

No build, no install, no server required:

```
open web/index.html          # or just double-click it
```

or serve it if you prefer:

```
python3 -m http.server 8000 --directory web
# → http://localhost:8000
```

You'll land on the install flow — the one screen that says what it will
remember, for how long, and what it will never do — then flash the frames and
you're wearing them.

## What's simulated, and where

Every system in the pitch maps to a concrete mechanism in `web/app.js`:

| Pitch claim | In the simulator |
|---|---|
| **The 90-milliwatt eye** — five perception tiers, escalating only on evidence | The ladder panel. Tier 2 ("aware — 1fps gray → embeddings") is the resting state at 90 mW. Demo 3 escalates to Tier 3 on evidence and back down. |
| **LED wired to the sensor power rail** | The frame LED (top-right of the viewport) lights whenever the tier reaches capture-capable levels. No code path renders capture states with it dark. |
| **Silence as a first-class input** | The whisper box (no wake word — submitting *is* the wake signal, with the 25 dB / beamformer / 184 ms detect flash) plus the four-gesture EMG grammar: pinch · double-pinch · pinch-and-hold · thumb-swipe. |
| **Sub-350 ms local turns** | Timers, "what time is it", "repeat that" resolve on a local route in 160–330 ms. Watch the *Last turn* telemetry. |
| **The compositor, not a card slot** | `hud()` enforces a hard 40-character budget at the render layer. Longer content is paged; thumb-swipe advances. Spatial audio markers: Vesta always 30 cm ahead center, notifications on a fixed shelf over the right shoulder. |
| **Two-brain stack** — Haiku opens, Fable finishes | The router classifies each turn: local / haiku / fable. Fable turns show a fast "on it…" opener so a deep query never leaves dead air. The turn mix counter tracks the 75% claim. |
| **Memory** | A 12-hour episodic buffer (purged on dock), a human-readable semantic store (every entry timestamped, editable, deletable), and pins (pinch-and-hold). Docking runs the nightly consolidation: Fable reads the day, distills it, purges the buffer. |
| **The room** | The context field: Alone / With one / Group / On a call. All of Vesta's output flows through one gate that enforces the register — voice, whisper, or HUD-only with the voice parked silently on the shelf. |
| **< 1 wrong interrupt per day** | Proactive interrupts are counted. Pinch-and-hold right after one marks it *wrong* — Vesta raises her own threshold and stops interrupting. |
| **No stranger identification, ever** | Ask "who is that?" — the refusal is in the architecture (there is no identification path), not a setting. |
| **The executor holds the keys** | Multi-step chains narrate the plan first and run only on a pinch. Irreversible actions (money) bounce to a phone modal with a fingerprint hold. |
| **The uninstall is one tap** | And it takes everything with it — wipes all state and returns you to the install screen. |

## The five demos

The keynote, playable in order from the sidebar:

1. **The keys** — answered from a Tier-2 embedding match. No image ever existed.
2. **The platform** — silent question, silent answer, silent pinch to confirm.
3. **The name** — contacts-only recognition (watch the LED), then the stranger refusal.
4. **The chain** — one sentence, three actions, plan narrated first; the deposit bounces to the phone.
5. **The interrupt** — the whole company. Watch how long the silence holds.

## Layout

```
docs/PITCH-v0.4.md   the pitch this implements
web/index.html       structure: install flow, viewport, control rail
web/style.css        the waveguide look
web/app.js           the OS: ladder, compositor, router, memory, demos
```

Vanilla HTML/CSS/JS. No dependencies, no network, no accounts. All state lives
in `localStorage` on your machine — which is, after all, the point.
