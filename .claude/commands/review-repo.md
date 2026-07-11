# /review-repo

Clone a third-party repo into an episode sandbox, put it through the safety gate,
actually run it, write the honest `report.md`, advance `STATE.md` to `review: done`,
and record phase metrics. This is the core command of the pipeline — every episode
starts here.

**Usage:** `/review-repo <url> [--episode <id>]`

- `<url>` — the git URL of the repo to review (e.g. `https://github.com/owner/repo`).
- `--episode <id>` — optional. Reuse an existing episode (e.g. `2026-07-ep003`) instead
  of creating a new one. Use this to resume a review that was interrupted, or to re-run
  the review step after a failed attempt.

---

## Step 1 — Resolve episode

If `--episode <id>` was passed, use that episode: `episodes/<id>/`. Do not create a new
one.

Otherwise, create a fresh episode by running:

```bash
pnpm episode:init <url>
```

This prints the new episode id (e.g. `2026-07-ep004`) to stdout. Capture it — every
later step in this command refers to it as `<ep>`. The init script also creates
`episodes/<ep>/assets/.gitkeep`, `episodes/<ep>/shorts/.gitkeep`, and a `STATE.md`
seeded from `templates/STATE.md` with `repo_url` already set.

Either way, **read `episodes/<ep>/STATE.md` first**, before doing anything else. This
command is resume-friendly: if `current_phase` is already past `review` with
`phase_status: done`, or the checklist shows `review` checked, stop and tell the host —
don't silently redo work. If `phase_status: review` shows an in-progress or failed state
(e.g. from an earlier interrupted run), pick up from wherever the artifacts on disk
(`sandbox/`, `report.md`) indicate you left off, rather than starting the clone over.

---

## Step 2 — Clone into sandbox

Clone the target repo, shallow, into the episode's sandbox directory:

```bash
git clone --depth 1 <url> episodes/<ep>/sandbox/<repo>
```

(`<repo>` is the repo name, e.g. the last path segment of `<url>` without `.git`.)

**This sandbox — `episodes/<ep>/sandbox/` — is the ONLY place in this entire project
where third-party code, network access on its behalf, and execution of its
install/build/run scripts are allowed.** Nothing from the cloned repo may be installed
globally (no `npm install -g`, no global pip/cargo/go installs, no writes outside
`episodes/<ep>/sandbox/`). Never copy, source, or expose any secrets, tokens, `.env`
files, or credentials from this project (or the host machine) into the sandbox or to
anything the sandboxed code can read.

---

## Step 3 — Safety gate (MANDATORY, before running anything)

Before installing a single dependency or executing a single script from the cloned
repo, scan it for dangerous patterns. At minimum check for:

- **`postinstall` / `preinstall`** (and any other lifecycle) scripts in `package.json`
  — these run automatically on `npm install`/`pnpm install` and are a common supply-chain
  attack vector.
- **`curl … | sh`**, **`wget … | bash`**, or equivalent "pipe a remote script straight
  into a shell" patterns anywhere in the repo (install docs, Makefiles, CI configs,
  shell scripts).
- **Obfuscated payloads** — minified/base64-encoded/eval-wrapped blobs embedded in
  install or build scripts, unusually named binaries, anything designed to be unreadable.
- **Network calls inside build or install scripts** — a `postinstall`, `Makefile`
  target, or build step that reaches out to an external URL (downloading a binary,
  phoning home, etc.) beyond the normal package manager registry traffic.

If any of these hit:
1. Record the exact finding under the report's **"Подозрительно" (Suspicious)** section
   — quote the offending line(s) and the file they're in.
2. **STOP before executing that step.** Do not run the flagged install/build/script.
   Require the host's **explicit approval** before proceeding with that specific step.
   A generic "looks fine" is not approval — describe exactly what would run and wait for
   an explicit yes.

Independently of whether anything was flagged: **before executing any of the repo's
code at all** (even a clean-looking `npm install`), show the host the candidate repo —
what it is, its star count, and what running it concretely will do (what gets
installed, what gets executed) — and get explicit go-ahead before proceeding to Step 4.
This applies even to a repo that was already vetted at the scout phase; the go-ahead
here is specifically about executing code, not about the choice of repo.

---

## Step 4 — Understand & run

With the safety gate cleared (and any flagged step explicitly approved):

1. Read the README and skim the code structure (directory layout, entry points,
   package manifest) to understand what the project claims to do.
2. Detect the stack from the manifest present at the repo root: `package.json` (node),
   `requirements.txt`/`pyproject.toml` (python), `go.mod` (go), `Cargo.toml` (rust), or
   equivalent for other ecosystems. If more than one is present, treat the primary
   language of the README/marketing as the stack to exercise first.
3. Attempt the install step for that stack (e.g. `npm install`/`pnpm install`,
   `pip install -r requirements.txt`, `go build`, `cargo build`) and then attempt to run
   the project, plus **at least one basic usage scenario** described in the README
   (a documented example command, a quickstart snippet, a sample input) — enough to form
   an honest opinion on whether it does what it claims.
4. **All of this — install, build, run, every command the cloned repo's code executes —
   happens strictly inside `episodes/<ep>/sandbox/<repo>`.** Never run repo-provided
   scripts from the project root or from any directory outside the sandbox.
5. Note everything as you go: what worked, what broke (with the actual error text), and
   anything noteworthy enough to become a "video moment" later.

---

## Step 5 — Write report

Copy the template and fill it in:

```bash
cp templates/report.md episodes/<ep>/report.md
```

Fill in **every** section — do not leave any as the template's placeholder text:

- **Заявлено (Claimed)** — what the README / marketing promises the project does.
- **Работает (Works)** — what actually worked in the sandbox, concretely.
- **Сломалось (Broke)** — what failed, with the actual error output, not a paraphrase.
- **Подозрительно (Suspicious)** — anything found in Step 3 (quote it), plus any
  star-forensics signal (star velocity vs. contributor count/repo age/issue activity)
  worth flagging even if it wasn't a hard safety-gate hit.
- **Моменты для видео (Video moments)** — a bulleted list of moments worth showing on
  the future screencast. These must be described **semantically**: describe **what** to
  show (the action, the error, the surprising result), never a timecode. There is no
  recording of this sandbox run — this is "clock (a)" in the pipeline's timecode
  discipline — so nothing here can point to a specific moment in an existing video; it
  can only describe *what to re-create* when the host records the screencast later. Do
  not use `MM:SS`-style notation, or any other stand-in for a timecode, anywhere in this
  report. Good: "the moment `npm start` throws `ERR_MODULE_NOT_FOUND` on a fresh clone."
  Bad: any reference implying a specific point in a recording.
- **Черновой вердикт (Draft verdict lean)** — argue, in one paragraph, a first-pass
  verdict on the fixed scale: **ГОДНОТА** (genuinely good, delivers on its claims),
  **ХАЙП** (overhyped — works, but far short of the buzz), **НАКРУТКА** (inflated stars
  / manufactured traction), or **РАНО** (promising but too early / not usable yet).

---

## Step 6 — Update STATE.md

Edit `episodes/<ep>/STATE.md`:

- Frontmatter: set `current_phase: review` and `phase_status: done`. Set
  `updated:` to today's date (`YYYY-MM-DD`).
- `## Artifacts`: update the `report.md` line to show it's present (e.g.
  `report.md: present`) and update the `sandbox/` line to point at the cloned path
  (e.g. `sandbox/: episodes/<ep>/sandbox/<repo>`).
- `## Next action`: replace it with `Run /script`.
- `## Phase checklist`: check the `review` box (`- [x] review`).

Leave every other field and section (repo_url, title, verdict, youtube_video_id, the
rest of the checklist) untouched — this command only owns the review phase.

---

## Step 7 — Record metrics

Append a `phase_metrics` row for this run (phase `review`), and make sure an `episodes`
row exists first (insert it if this is the first phase recorded for this episode).
Track `startedAt` from when you began Step 2 (the clone) and `endedAt` when Step 6
finishes; count `iterations` as the number of install/run attempts you made in Step 4
(1 if it worked cleanly on the first try, more if you had to retry).

Run something shaped like this (adapt the values — episode id, number from STATE.md's
frontmatter, repo URL, timestamps, iteration count, notes — to the actual run):

```bash
node --import tsx -e "
import { openDb, schema } from './db/client.ts';
import { eq } from 'drizzle-orm';

const db = openDb();
const episodeId = '<ep>';
const now = Math.floor(Date.now() / 1000);

const existing = db.select().from(schema.episodes).where(eq(schema.episodes.id, episodeId)).all();
if (existing.length === 0) {
  db.insert(schema.episodes).values({
    id: episodeId,
    number: <number from STATE.md frontmatter>,
    repoUrl: '<url>',
    createdAt: now,
  }).run();
}

db.insert(schema.phaseMetrics).values({
  episodeId,
  phase: 'review',
  startedAt: <epoch when Step 2 began>,
  endedAt: now,
  durationS: now - <epoch when Step 2 began>,
  iterations: <number of install/run attempts>,
  notes: '<one-line summary, e.g. verdict lean and any suspicious findings>',
}).run();
"
```

This creates/updates `db/tracker.sqlite` (WAL mode, via `openDb()` from `db/client.ts`).
If `db/tracker.sqlite` doesn't exist yet, `openDb()` creates it, but the schema must
already be migrated (`pnpm db:migrate`) — run that first if the tables don't exist.

---

## Output contract / side-effects

This command writes **only**:
- Inside `episodes/<ep>/` — the new/updated `STATE.md`, `report.md`, and everything
  under `episodes/<ep>/sandbox/` (the cloned repo and anything it produces while
  running).
- `db/tracker.sqlite` — the episode row (if new) and one new `phaseMetrics` row.

Nothing is installed or written globally, nothing outside `episodes/<ep>/` and
`db/tracker.sqlite` is touched, and no secrets or credentials are ever exposed to the
sandboxed repo's code.
