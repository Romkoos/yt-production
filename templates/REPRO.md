# REPRO — {{EPISODE_ID}} ({{REPO}})

<!-- The reproduction protocol — the executable path the host follows to RECORD the
     episode without understanding the repo internals.

     ACCEPTANCE TEST: the host can record every scene without making a decision that
     isn't written here. If a step needs a choice this file doesn't answer (which
     Node? which flag? did that build succeed?), the protocol is INCOMPLETE — fix it.

     Ownership:
       /review-repo  writes  ## Prepared states, ## SETUP, ## Failure recipes
                     (from sandbox + report.md — before script.md exists).
       /script       fills   ## Scenes (one block per [СКРИНКАСТ] cue, in shooting
                     order) and the **Recording time budget** line.

     Honesty: every command/duration/success-indicator here must be what ACTUALLY
     happened in the sandbox (report.md), not the README's version. Clock (b): scene
     steps are semantic shooting instructions, never timecodes. -->

**Repo:** {{REPO_URL}}  ·  **Verdict:** {{VERDICT}}  ·  **Sandbox:** `episodes/{{EPISODE_ID}}/sandbox/{{REPO_DIR}}`
**Recording time budget:** {{TIME_BUDGET}}  <!-- /script fills: est. total record time if this protocol is followed -->

---

## Prepared states

<!-- Ready-to-record states so no take waits on a long install/build/test. List each:
     name · path · what's already done · which SCENEs it serves · how to rebuild it.
     If a scene needs a CLEAN state (e.g. the install take), say how to get one without
     destroying the built state (a second clone), so recording order is unconstrained. -->

- **READY** — `episodes/{{EPISODE_ID}}/sandbox/{{REPO_DIR}}` — <deps installed / built? what's ready> — serves scenes <n…>.
- <clean/second-clone state if any long op must be re-shot from scratch>

---

## SETUP — zero to running (copy-paste)

<!-- Exact commands from a clean clone to a running project. Use the flags that ACTUALLY
     worked (e.g. --ignore-scripts), not the README's. For EACH step give: the command,
     expected duration, and the success indicator to watch for. Include the workarounds
     you discovered. State env vars (or "none"). -->

```bash
# <step> — ~<duration>, success: "<what you should see>"
...
```

---

## Scenes  <!-- one block per [СКРИНКАСТ] cue, in shooting order; SHOTLIST item N → #scene-N -->

<!-- /script fills these. Keep the count and order identical to the [СКРИНКАСТ] cues in
     script.md so SHOTLIST's numbered items line up with #scene-N anchors. -->

<a id="scene-1"></a>
### SCENE 1 — <short label>  ·  _beat: <beat>_
- **Do:** <commands / clicks to perform, verbatim>
- **On screen:** <what appears, so the host knows it worked>
- **Wait/Cut:** <perf/timing note — "build takes ~90s, start recording after"; or "—">
- **Reset:** <how to re-shoot this scene, or "— (idempotent, re-runnable)">

---

## Failure recipes

<!-- The interesting breakages from report.md's «Сломалось», reproducible ON DEMAND.
     Each: the exact trigger command(s) → the exact error text shown on screen, and which
     SCENE shows it. If a failure was flaky / environment-dependent, say so explicitly and
     mark it "capture from agent test logs instead" rather than pretending it reproduces. -->

- **<failure>** (scene <n>) — trigger: `<command>` → shows `<exact error>`. <deterministic | FLAKY: capture from agent test logs instead>.
