# The app runs on the machine it is built on

**Status:** built — every fix walked on this machine in a browser; the PowerShell start is the one step left for the owner.
**Branch:** roam-local-dev (cut from `roam-ar-view`)
**Open questions:** none

## Why

Three separate faults stop anyone from running ROAM on this computer, and all three hide from CI: the development server refuses to start at all, the command the README tells you to type is not a command Windows understands, and when the page does come up the scanned room is a black rectangle. The deployed site is fine, which is exactly what makes this worth fixing — the only place the app is broken is the place it is written, so every change has to be checked by deploying it.

## What Changes

- **`npm run dev` starts, on any computer.** Today it dies before it listens, saying `Denied ID … scripts/employee-bootstrap.mjs?raw`: the Worker reads the setup script out of the repo's own `scripts/` folder, which sits above the app, and a development server serves nothing above its own root unless it is told to. It gets told.
  ```mermaid
  flowchart LR
    dev["npm run dev"] --> root{"above the app?"}
    root -->|allowed| up["it listens"]
    root -->|not| dies["no server"]
  ```

- **The command works in a Windows shell too.** `CLOUDFLARE_ENV=local vite` is how one shell sets a value for one command; the shell npm uses on Windows reads it as a program name and says `'CLOUDFLARE_ENV' is not recognized`. The script sets the value in a way every shell agrees on, so the same `npm run dev` works for everyone.

- **The scanned room draws again, instead of a black rectangle.** The scan is loaded as a level-of-detail tree, and Spark draws such a tree only through its level-of-detail path. The laptop's first detail step — "everything" — turned that path off to mean *draw it all*, and so drew none of it: the file was never fetched, the view stayed empty, and no error was shown anywhere. The path now stays on at every step, with "everything" setting no cap, so the whole room appears on the laptop and the phone keeps the detail budget that was measured for it.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">665 video views · 546,977 splats</span></div>
    <div class="bar">before: a black rectangle, no error, nothing fetched</div>
    <div class="bar">after: the scanned room, as the live site draws it</div>
  </div>
  ```

- **The page's own data is there to be read.** Every load currently throws `no such table: roam_notes` from the notes route, because the local database has no tables: the build applies migrations only in CI, by design, and nothing tells a person to do it by hand. One command does it, named beside the others, and the README step says to run it once.

Non-goals: a prebuilt level-of-detail file, which Spark has a tool for and nothing here needs yet; bringing this branch's scan file up to the newer one on the default branch; and any change to how the deployed app loads or draws anything, which works today.

## Capabilities

### New Capabilities

- `local-development`: the app starts on a developer's own computer, on any shell, with the data its pages read, and says plainly what to do when a step has not been run.

### Modified Capabilities

- `roam-scene`: the scan is drawn wherever the app runs, at full detail on a machine that keeps up, with the level-of-detail path that draws it never switched off.

## Impact

- `app/vite.config.ts` gains a `server.fs.allow` entry for the repo root, because `app/worker/employee-access/setup-file.ts` imports `../../../scripts/employee-bootstrap.mjs?raw`.
- `app/package.json`'s `dev` script stops relying on shell syntax; a small `app/scripts/` runner sets `CLOUDFLARE_ENV` and starts Vite, in the house style and with no new package. A `db:migrate:local` script joins the two that already exist for staging and production.
- `app/src/apps/roam/detail.ts`'s first step keeps `lod` on, with one comment saying why; `RoomViewer.test.tsx` asserts the path is on from the first frame with no cap. `RoomViewer.tsx`, `ar-view.ts` and `splat-scene.ts` are not edited.
- `wiki/development/running-locally.md` holds the start command, the one-off migration and the dev server's root; `wiki/stack/level-of-detail.md` holds Spark's two switches and how to tell an empty view from a failed load. `app/README.md` is the Vite template and stays so. A test, `app/src/local-dev.test.ts`, refuses inline shell variables in package scripts and checks the root allowance stays.
- No schema change, no route change, no new package, and nothing about the deployed app's behaviour.

## Decision log

- **2026-10-25** — Asked where the black screen was → local development, not the deployed site, which was then ruled out by walking both staging and production in a browser.
- **2026-10-25** — Asked what the change should cover, given two other workspaces hold this branch → chose all three faults, including the level-of-detail one in `RoomViewer.tsx`.
- **2026-10-25** — Asked how to fix the level-of-detail fault → chose to stop asking for it, on the inference that the file carried no tree. **Superseded below.**
- **2026-10-25** — Asked which branch → chose a new branch cut from `roam-ar-view`, as the gesture work did, so the AR branch's own history stays its own.
- **2026-10-25** — Found by measuring, not inferring: with `lod: true` the browser never requests `room.spz` at all — resource timing lists the scene, Spark's bundle and the app's own modules, and no scan — the WebGL context is healthy, and moving to Top view stays black. With the flag off, the room draws immediately. Spark 2.4.0 is the latest release, so there is no upgrade to wait for, and it ships a separate Rust `build-lod` tool, which is what a level-of-detail tree is meant to come from.
- **2026-10-25** — Found: the AR work's tests pass with the flag on because they stand in for `SplatMesh` and only assert that the option was passed, so nothing in the suite can notice that the scan never loads. A test that would have caught it belongs with the change that brings level of detail back, on a real file.
- **2026-10-25** — Found: the development server's refusal is not new code — the `?raw` import above the app's root has been there — but a changed lockfile re-optimizes dependencies and re-scans the Worker entry, which is what makes it bite. So it fires for whoever next changes a package.
- **2026-10-25** — Assumed: the local migration stays a command somebody runs once, rather than something `dev` does on every start, because migrating a database as a side effect of starting a server is a surprise, and the two existing migrate scripts set the pattern.
- **2026-10-25** — Found while building, and it reverses the inference above: `detail.ts` records the owner measuring the LOD step at 65–80 fps on their phone, so the tree does load. The laptop's first step, "everything", set `enableLod` to false on the renderer while the mesh was built with `lod: true`, and Spark draws a tree only through its LOD path. Setting that one field to true drew the whole room at once, in the browser, on this machine.
- **2026-10-25** — Asked again, since the premise changed → chose to keep level of detail and fix the step, over dropping the flag: one word, every splat on the laptop (Spark's desktop default cap is 2.5 million), and the phone keeps its measured budget.
- **2026-10-25** — Found while building: `app/README.md` is still the Vite template, so the local steps went to the wiki rather than a README that says nothing about this app.
- **2026-10-25** — Checkpoint: built. Dev server starts from `npm run dev` in Git Bash, the room draws at full detail, `db:migrate:local` clears the missing-table error, and the suite's new test refuses an inline shell variable in any script.
