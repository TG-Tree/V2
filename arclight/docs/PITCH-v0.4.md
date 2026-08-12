# ARCLIGHT

## The pitch

**Premise: you download it to the glasses.**
Not a companion app. Not a phone tether with camera permissions. An operating system that replaces Meta AI on the frames themselves — firmware down to the ISP, the NPU, the waveguide, the band.

v0.4 · The document you present. Companions: v0.1 concept · v0.2 Fable edition · v0.3 build plan

---

## I. Cold open

A woman is standing on a train platform in Chicago. Her hand is at her side. Her mouth barely moves.

*"Did I already send Dana the address?"*

Half a second later, in a voice only she can hear: *"You drafted it at 8:40 and never sent it. Send now?"* She pinches her thumb and index finger once. Sent. Nobody within three feet has any idea anything happened.

That interaction is impossible on every pair of smart glasses currently shipping. Not because the hardware can't do it — **the hardware already does all of it.** The camera saw the draft. The band read the pinch. The mic array can isolate a whisper. The NPU can run the model.

The hardware is not the problem. Nobody has written the operating system.

---

## II. What we're actually selling

**Arclight is an OS you download to your glasses.** Twelve minutes, over the air, on the charging case. You go to bed with a camera you can talk to. You wake up with something that has been paying attention.

The pitch in three sentences:

> Meta built a phone assistant and put it on your face.
> Arclight is built for the face, from the sensor up.
> Same glasses. Different mind.

And the reason it's worth building on someone else's hardware: **the shell is finished.** Ray-Ban Meta is a genuinely great object. Nobody needs to reinvent titanium hinges and open-ear drivers. What's unfinished — catastrophically, obviously unfinished — is the intelligence sitting inside it, which wakes on command, answers one question, and forgets you exist.

---

## III. What owning the metal unlocks

This is the entire argument. Every feature below is *impossible* as a phone app and *trivial* as firmware.

### 1. The 90-milliwatt eye
The perception ladder from v0.1 — five tiers, escalating only on evidence — runs on the AR1 NPU. Tier 2 is the one that matters: **1fps grayscale, converted to embeddings inside the image pipeline, never emitted as a viewable frame.** Ninety milliwatts. About what the LED costs.

An app can't do this. An app gets session-based camera access, which means the camera is either off or *obviously on*. Firmware gets a third state: **aware.**

That third state is the entire product. It's how the glasses know you set your keys on the counter without anybody, including you, having asked them to watch.

### 2. Silence as a first-class input
Own the mic array and you own the beamformer. Point it at the wearer's own mouth and a whisper at 25dB — inaudible past 40cm — becomes a clean transcript. **No wake word.** The acoustic signature of self-directed whisper *is* the wake signal, detected on-temple in under 200ms.

Own the Neural Band's raw EMG and you get the full gesture grammar, not media-button leftovers: pinch to confirm, double-pinch to summon, pinch-and-hold to pin a moment, thumb-swipe to advance. Hand at your side. Invisible.

Voice assistants lose in public because talking to your glasses on a train makes you look unwell. Arclight's primary input modes are **whisper and stillness.**

### 3. Sub-350 millisecond local turns
No Bluetooth round trip for "set a timer." No cloud for "repeat that." The local tier answers on the frames. Latency on a wearable isn't a spec-sheet number — it's the difference between a tool and a toy. Under 350ms feels like thought. Over a second feels like dictating to a machine.

### 4. The compositor, not a card slot
Direct access to the waveguide means the HUD obeys one rule: **nothing renders that isn't glanceable in 800ms.** One line, an arrow, a timer, a name, a three-item list. That's the whole vocabulary, enforced at the render layer with a 40-character budget.

And head-tracked HRTF at IMU latency means sound has *position*. Navigation cues play from the direction of the turn and grow as you approach. Notifications live on a fixed shelf over your right shoulder. Vesta's voice always originates 30cm ahead, center, so you always know what's her and what's the world.

### 5. A hardware interlock on the LED
Wire the capture indicator to the sensor's power rail. No firmware path can capture with it dark. **Publish the schematic.**

This is the one that wins the argument that camera glasses can't win. Every competitor treats bystander privacy as a compliance checkbox. Arclight treats it as the reason to buy — and only firmware can make the promise structurally, rather than promising it in a settings menu nobody believes.

---

## IV. Vesta

The mind is **Claude Fable 5**, with Haiku 4.5 on the fast path — the two-brain stack from v0.2. Haiku opens, Fable finishes, so a deep query never leaves dead air. Seventy-five percent of turns never reach the frontier model at all.

But the model isn't the pitch. Everyone will have a good model. **The pitch is that Vesta has a memory and a sense of the room.**

**Memory.** Twelve hours of episodic context, indexed on-device, purged continuously. Permanent pins on command. A semantic store of durable facts about you — every one human-readable, source-timestamped, editable, deletable. Nightly, on the charger, Fable reads the day and distills it: what's worth keeping, what loops are still open, what changed.

**The room.** One context field governs everything Vesta does: are you alone, with one person, in a group, or on a call? Alone, she'll speak up unprompted. With someone, she whispers and never interrupts. In a group, total silence unless summoned — HUD only. Current assistants have exactly one social register: *loud.*

And one hard number, the hardest in the whole spec: **fewer than one wrong proactive interrupt per day.** Not a classifier threshold — a judgment call, adjudicated by Fable against everything it knows about you and this moment, before it is allowed to make a sound. An ambient assistant that's wrong twice a day gets turned off inside a week. This is the number the product lives or dies on.

---

## V. The five demos

This is the keynote. Five moments, in order.

**1. The keys.** *"Where did I leave my keys?"* — 8:40 this morning, kitchen counter, with the frame. Nobody asked the glasses to watch. They were at Tier 2. **Nothing shipping today can answer this.**

**2. The platform.** The whisper demo from the cold open. Silent question, silent answer, silent confirm, on a crowded train.

**3. The name.** You're at a conference. Someone you met once walks up. A single line on the waveguide: *Priya — Hexler, met at Reforge, has a daughter starting college.* Contacts only — Arclight will not identify a stranger, ever, on-device or otherwise, even if asked. That refusal is architectural, not a policy toggle.

**4. The chain.** *"Sort out tonight."* Vesta: *"7:30 at Kestrel, tell the group, push your 6pm to tomorrow — go?"* One pinch. Three actions. Anything over three steps gets the plan narrated first; anything irreversible bounces to your phone with a fingerprint. The model never holds the keys — the executor does.

**5. The interrupt.** Walking to the station. Unprompted, once: *"The 7:14's cancelled. The 7:31 still gets you there by nine."* It was right, it was once, and it was the only thing it said all afternoon.

Demo five is the whole company. Anyone can build one through four. **Restraint is the product.**

---

## VI. The install

The moment matters, so design it.

You set the glasses in the case. The Arclight card appears on your phone. One screen — *what it will remember, for how long, and what it will never do* — and a switch. Twelve minutes on the charger.

Then a first-run that is not a tutorial. Vesta introduces herself in about eleven words, asks for exactly one thing (whatever it needs to be useful today), and gets out of the way. The rest is learned by wearing them.

The uninstall is one tap and it takes everything with it. Say that out loud in the pitch. It's a feature.

---

## VII. Why this is worth a lot of money

**The wearable assistant is the next platform, and it is currently vacant.** Tens of millions of camera glasses are on faces. The software on all of them is a voice search box. Whoever ships the first one that *remembers* takes the category, and there is roughly a two-year window before that's obvious to everybody.

**The moat is trust, and trust compounds.** An assistant that has known you for eight months is not replaceable by a better model. The episodic history, the semantic store, the calibrated interrupt threshold — those live on your device and they are worth more every week. Model advantages last a quarter. Memory advantages last years.

**Privacy is the go-to-market, not the legal review.** The entire category is stalled on one objection: *people don't want your camera in their face.* Nobody has answered it structurally. Hardware LED interlock, embeddings-not-images, no stranger recognition ever, and a memory that physically lives on your phone — that's not a compliance posture, it's the marketing campaign.

**And the economics work because of routing discipline.** Seventy-five percent of turns resolved locally or by Haiku puts blended model cost under twenty cents per active day. Free tier viable. Pro tier — Fable, consolidation, background agents — profitable at a normal subscription price.

---

## VIII. The ask

Three paths, and they're not exclusive:

**Ship it ourselves.** Twelve people, twelve months, the roadmap in v0.3. Arclight as the OS you flash onto glasses you already own.

**Ship it with Meta.** They own the shell, the retail, the supply chain, and the face of the category. What they don't have is a mind people will trust with a camera. Fable inside Meta AI, Arclight as the layer — the same arrangement that put someone else's silicon in everyone's phone.

**Ship it as the reference implementation** and let the ecosystem come to it — Faculties instead of apps, where developers declare when they're relevant and Vesta owns all presentation. One coherent assistant instead of forty apps fighting over your ears.

---

The glasses on people's faces right now are already capable of every single thing in this document.

They're just running the wrong software.
