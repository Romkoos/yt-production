# REPRO — {{EPISODE_ID}} ({{REPO}})

<!-- The reproduction protocol under the LINEAR-TAKE doctrine. The host records THE USER'S PATH,
     live, in one continuous take from a clean machine state — the steps a real user would take, in
     the order a real user would take them. This file is that path, written so the host can shoot
     it top-to-bottom without understanding the repo internals.

     ACCEPTANCE TEST: the host can record the whole flow, in order, without making a decision that
     isn't written here. If a step needs a choice this file doesn't answer (which download? did that
     install succeed? what did the dialog say?), the protocol is INCOMPLETE — fix it.

     Ownership:
       /review-repo  walked the real path, so it writes  ## Clean slate, ## User flow,
                     ## Evidence inserts, ## Environment caveats, and (optional) ## Prepared states.
                     The flow steps and evidence proofs carry <a id="scene-N"> anchors, numbered in
                     flow order (which IS shooting order).
       /script       writes the [СКРИНКАСТ #N] cues that reference these scenes, in the same linear
                     order, and fills the **Recording time budget** line. `pnpm prep` hard-fails if
                     a #N has no scene block, a scene block has no #N, or the anchors don't ascend.

     RECORDING.md (the host's screencast-session doc) is ASSEMBLED from the pieces below — the wipe
     checklist on top, then the flow with evidence inserts inline at their anchor points. Write for
     someone who will not open this file mid-session. This file stays the source of truth.

     Honesty: every command / duration / on-screen result here must be what ACTUALLY happened in the
     sandbox (report.md), never the README's version. Clock (b): steps are semantic shooting
     instructions, never timecodes. -->

**Repo:** {{REPO_URL}}  ·  **Verdict:** {{VERDICT}}  ·  **Sandbox:** `episodes/{{EPISODE_ID}}/sandbox/{{REPO_DIR}}`
**Recording time budget:** {{TIME_BUDGET}}  <!-- /script fills: est. total record time for one linear take -->

---

## Clean slate

<!-- Exact commands to wipe ALL prior state of the product on the RECORDING machine, so the take
     starts as a real first-time user: app data / config, downloads, quarantine caches, any sandbox
     traces on the recording path. The review phase must discover WHERE the product leaves state and
     write the wipe accordingly — a first-run dialog or onboarding that won't fire on a machine that
     has already seen the product is exactly what this prevents. State env vars to reset (or "none"). -->

```bash
# <what this wipes> — run BEFORE recording
...
```

---

## User flow

<!-- The numbered linear path a real user walks: download in browser → install → first run →
     onboarding → core usage. One <a id="scene-N"> + `### FLOW N` block per step, IN ORDER. Where the
     README's own instructions break, the step SAYS so and continues the way a stubborn user would —
     the break happens live, here, not as a separate "failure recipe". The N is the scene identity
     the script's [СКРИНКАСТ #N] cue points at. -->

<a id="scene-1"></a>
### FLOW 1 — <short label>  ·  _beat: <beat>_
- **Do:** <what the user does — the click / command / download, verbatim>
- **On screen:** <what the user sees, so the host knows it matched>
- **Wait/Cut:** <perf/timing note — "install ~40s, start recording after"; or "—">
- **Reset:** <how to re-shoot this step, or "— (idempotent)">

---

## Evidence inserts

<!-- The proofs (spctl / lsof / strings / git log …) that turn a suspicion into a shown fact. Each is
     ANCHORED to the flow step where the narrative needs it, and gets its own <a id="scene-N"> so the
     script can cue it. Carry the honesty-scoping notes over AS-IS — the ⚠️ bullet ("чего этот замер
     НЕ доказывает") is load-bearing and must reach the host. -->

<a id="scene-2"></a>
### EVIDENCE 2 — <what this proves>  ·  _beat: <beat>_
- **Anchor:** <which flow step, and where relative to it — "сразу после того как Gatekeeper показал диалог">
- **Do:**
  ```bash
  ...
  ```
- **On screen:** <the exact output the host must get in frame>
- ⚠️ **Чего этот вывод НЕ доказывает:** <the honest scope of the proof>

---

## Environment caveats

<!-- Every one-shot moment the review phase can identify: things that behave differently on a machine
     that has already seen the product (e.g. Gatekeeper caching its verdict, so the block dialog is
     unreproducible after the first Open). Flag each: «этот кадр существует только в первом прогоне».
     RECORDING.md surfaces these under ⚠️ ОДИН ДУБЛЬ so the host doesn't blow the only take. -->

- <one-shot moment> — существует только в первом прогоне с чистого листа; со второго дубля не снять.

---

## Prepared states  <!-- OPTIONAL — off-camera time savings ONLY -->

<!-- Ready-made state that saves time BEFORE the session (e.g. models pre-downloaded so a take
     doesn't wait on a 10-minute pull). This NEVER appears in frame as a shortcut a real user
     wouldn't take. Omit this section entirely if there's nothing to prepare. -->

- **<name>** — `<path>` — <what's already done> — saves <which off-camera wait>.
