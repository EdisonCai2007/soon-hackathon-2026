## Context

The app is a Vite build with the Cloudflare plugin: `app/` is Vite's root, the browser side in `app/src/`, the Worker in `app/worker/`, and the repo's own scripts a level up in `scripts/`. CI builds and deploys it on Linux; the person writing it here is on Windows, in Git Bash.

Three faults, each measured in this workspace rather than inferred:

- **The server will not start.** `CLOUDFLARE_ENV=local npx vite` ends in `Error: Denied ID C:/…/scripts/employee-bootstrap.mjs?raw`. `app/worker/employee-access/setup-file.ts` imports that file with `?raw` so the setup route can serve it; the file is above Vite's root, and the dev server refuses to resolve anything outside its allowed roots. `vite build` resolves it at build time, so CI and every deploy are unaffected — nothing in the gate can see this.
- **The script is not portable.** `npm run dev` runs `CLOUDFLARE_ENV=local vite` through npm's script shell, which on Windows is `cmd.exe`: `'CLOUDFLARE_ENV' is not recognized as an internal or external command`.
- **The scan does not draw.** With the server up, `/apps/roam/` loads, the bar reads `665 video views · 546,977 splats`, the loading state clears — and the view is the box's own dark background. `performance.getEntriesByType('resource')` lists `scene.json`, Spark's bundle, `splat-scene.ts` and no `room.spz` at all. The canvas is 926×433 with `isContextLost() === false`, and Top view is just as empty. Setting `lod: false` in `RoomViewer.tsx` draws the room on the next reload.

Beside those, every page load throws `D1_ERROR: no such table: roam_notes` from `app/worker/apps/roam/note-routes.ts`: `scripts/cf-build.sh` applies migrations only in CI, deliberately, and no script or note tells a person to apply them locally.

What is already known and reused: `app/package.json` holds `db:migrate:staging` and `db:migrate:prod`, both plain `wrangler d1 migrations apply` lines, and the local database is declared in `wrangler.jsonc` under `env.local` with `remote: false`.

## Goals / Non-Goals

**Goals:**

- `npm run dev` starts and serves, from Git Bash, PowerShell or `cmd.exe`.
- The scanned room draws locally, as it does on the deployed site.
- One named command puts the local database in the state the pages expect, and the step is written down.
- The level-of-detail finding is recorded where the next person looking at phone performance will read it.

**Non-Goals:**

- Giving the phone its detail budget back. That needs a scan built by Spark's `build-lod` tool and is its own change; this one only stops asking for something that silently loads nothing.
- Bringing this branch's `room.spz` up to the newer one on the default branch. A separate concern, and the AR work's to decide.
- Changing anything the deployed app does. All three fixes are invisible in production.
- Making `dev` migrate the database by itself.

## Decisions

**Allow the repo root, not the one file.** `server.fs.allow` takes a list of roots; naming the repo root covers `scripts/employee-bootstrap.mjs` and anything else the Worker reads from the repo later, and keeps the config one line rather than a list that drifts. The alternative — moving the bootstrap script inside `app/` — would work, but the script is the repo's, used by tooling outside the app, and moving it to satisfy a dev server is the wrong way round. The cost is that the dev server will serve any file under the repo root on request; it binds to localhost, and the production build is unaffected.

**A Node runner for the dev script, not a package.** `node scripts/dev.mjs` sets `CLOUDFLARE_ENV` and spawns Vite, inheriting stdio and exiting with its code. Every shell runs `node` the same way. The alternative is `cross-env`, one more dependency for one line, which the repo's "write the least code" rule argues against; a second alternative, `npm_config` or a `.env` file, splits the setting away from the script that needs it. The runner follows the house pattern of `app/scripts/roam-ply-to-spz.mjs` and the repo's `scripts/*.mjs`.

**Stop passing `lod`, and say why in the wiki.** The flag is a real `SplatMeshOptions` field, so this is not a typo being fixed; on 2.4.0, with a plain `.spz`, it loads nothing and reports nothing. Spark's own `build-lod` tool and its `PagedSplats` type both point at a level-of-detail tree being a built artefact rather than something derived on the fly. Dropping the flag restores the behaviour the deployed site has today; the finding goes in the wiki so the next attempt starts from it instead of rediscovering a black screen. The alternative — keeping the flag and loading a purpose-built file — is the better end state and much more work: a Rust tool in the pipeline, a second asset to publish, and a real-file test. It is named as a non-goal rather than hidden.

**The local migration is its own command.** `db:migrate:local` sits beside the staging and production ones, pointed at the local database with `--local --env local`. A person runs it once after cloning and again when a migration lands. Making `predev` run it would migrate a database as a side effect of starting a server, and would slow every start for a step that is needed rarely.

### What a reader is told, and where

| Fact | Where it goes |
|---|---|
| Starting the app locally: the one command, the one-off migration | the ROAM app's README step, and `wiki/development/` |
| Why the dev server needs a root allowance | a comment in `vite.config.ts`, where it is read |
| `lod: true` with a plain `.spz` draws nothing on Spark 2.4.0 | `wiki/stack/` beside the scan's own page, with the evidence |

### How each fix is checked

The gate cannot see any of these three faults today, which is the point. So:

- **The dev script** gets a test that reads `package.json` and fails on shell syntax in any script — a value assignment before the command — so the next one is caught.
- **The Vite allowance** is checked by its own absence being noticed: a test asserts the config allows the repo root, since the failure it prevents only appears when a dependency changes.
- **The dropped flag** is checked by `splat-scene.test.ts` and `ar-view.test.ts` asserting the options passed no longer include `lod`, which is as much as a stand-in for `SplatMesh` can prove. The real check is a person opening the page; the walk-through task says so.

## Risks / Trade-offs

- **The dev server can read any file under the repo root** → it listens on localhost only, and the production build is unaffected. The narrower alternative, moving the script into `app/`, is recorded above.
- **Dropping `lod` loses the phone's detail budget** → named as a non-goal with the reason, and the wiki records what a real level-of-detail asset needs, so the AR work can plan it on evidence.
- **A test that bans shell syntax in scripts could annoy** → it names the script and the fix in its message, and it is one rule, not a linter.
- **The local database drifts from the migrations** → the command is named in the README beside the dev step; the failure it prevents is loud, not silent.
- **Two other workspaces hold this branch** → the change goes on a branch cut from it, touching `RoomViewer.tsx` in one line, so the merge is small wherever it lands.

## Migration Plan

Nothing to migrate: a config allowance, a script that sets a variable differently, one option dropped, one new script, and words. Reverting any of the three returns to today's behaviour, and the deployed app never sees a difference.

## Open Questions

None. Whether a purpose-built level-of-detail asset would work is a real unknown, but it belongs to the change that tries it, and is written down rather than guessed at here.
