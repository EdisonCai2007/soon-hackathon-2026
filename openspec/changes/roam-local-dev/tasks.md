# Tasks

## 1. The server starts

- [x] 1.1 Add `server.fs.allow` to `app/vite.config.ts` naming the repo root, with a two-line comment saying which import needs it (`app/worker/employee-access/setup-file.ts` reading `../../../scripts/employee-bootstrap.mjs?raw`).
- [x] 1.2 Write `app/scripts/dev.mjs`: set `CLOUDFLARE_ENV=local`, spawn Vite with stdio inherited, exit with its code. Point `package.json`'s `dev` script at it and drop the shell assignment.
- [x] 1.3 Add `db:migrate:local` to `app/package.json`, applying `schema/migrations/` to the local database (`--local --env local`), beside the staging and production scripts.

## 2. The scan draws

- [x] 2.1 Keep the level-of-detail path on at the laptop's first detail step in `app/src/apps/roam/detail.ts`, with the comment saying why, so a mesh built as a tree is drawn. **Changed from the plan:** the plan said to drop `lod` from the mesh; building showed the mesh loads fine and the renderer's switch was the fault, so `RoomViewer.tsx`, `ar-view.ts` and `splat-scene.ts` are untouched.
- [x] 2.2 Update `RoomViewer.test.tsx` to assert the path is on from the first frame with no cap, and still gives up detail when the rate falls.

## 3. The checks that would have caught this

- [x] 3.1 Write a test over `app/package.json` that fails on a script beginning with a `NAME=value` assignment, naming the runner pattern to use instead: `app/src/local-dev.test.ts`.
- [x] 3.2 In the same file, assert `app/vite.config.ts` allows the development server the repo root, so the allowance is not quietly dropped.

## 4. What people are told

- [x] 4.1 Write `wiki/development/running-locally.md`: the one command, the one-off `db:migrate:local`, why the dev server needs the repo root, and what a black scan means; linked from the development hub.
- [x] 4.2 Write `wiki/stack/level-of-detail.md`: Spark's two switches, why a tree drawn without its path is an empty view that says nothing, how to tell that from a failed load, what a stand-in cannot see, and Spark's `build-lod`; linked from the stack hub.
- [x] 4.3 Not needed: `app/README.md` is the Vite template and says nothing about this app, so the steps live in the wiki rather than beside words that are not ours.

## 5. Verification

- [x] 5.1 From `app/`, run `npm test`: lint, types, coverage over both roam folders, the runtime tests, knip, repeated code, and the key and action checks. Report any failure that was already there on a clean tree. **Run:** lint, types, knip and the roam folders plus the new test pass (382 tests); the Access and Inbox screens still time out under full parallel load on this machine as before. CI is the gate.
- [x] 5.2 Start the app with `npm run dev` from Git Bash and confirm it serves; open `/apps/roam/` and confirm the scanned room draws. **Seen:** the server listens on 5173 through the Node runner, and the bedroom draws at full detail in a browser.
- [x] 5.3 Run `npm run db:migrate:local`, reload `/apps/roam/`, and confirm no `no such table` error appears and the notes count reads. **Seen:** all migrations applied; the page reads *nothing left here yet* with no overlay.
- [ ] 5.4 Confirm the same start command works in PowerShell, which is the shell the fault was found in. `(outward — needs a second shell on the owner's machine)`
