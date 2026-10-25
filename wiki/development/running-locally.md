# Running the app on your own computer

The deployed app is checked by CI on every push; the one it is written on is checked by nobody but you. Three things have to be true for it to run here, and none of them can fail CI, so they are written down.

## Start it

From `app/`:

```bash
npm run db:migrate:local   # once after cloning, and again when a migration lands
npm run dev                # http://localhost:5173
```

`dev` is `node scripts/dev.mjs`, which sets `CLOUDFLARE_ENV=local` and starts Vite. It used to be `CLOUDFLARE_ENV=local vite`, which is one shell's way of setting a value for one command; npm on Windows runs scripts through `cmd.exe`, which reads that as a program called `CLOUDFLARE_ENV` and says it is not recognised. A Node runner is the same in every shell, and [a test](../../app/src/local-dev.test.ts) refuses any script that goes back to the inline form.

## The database has nothing in it until you say so

`scripts/cf-build.sh` applies migrations only in CI, on purpose: a developer's terminal never touches a remote database. The local database is a file under `app/.wrangler/`, and nothing applies migrations to it for you, so a fresh clone answers every page that reads a table with `D1_ERROR: no such table`. `npm run db:migrate:local` is the one command; it sits beside `db:migrate:staging` and `db:migrate:prod` in `package.json`, and starting the app never runs it as a side effect.

## The dev server has to be allowed above the app

`app/worker/employee-access/setup-file.ts` imports `../../../scripts/employee-bootstrap.mjs?raw`: the repo's own setup script, read at build time so the setup route can serve it. That file sits above `app/`, which is Vite's root, and the dev server refuses to resolve anything outside its allowed roots — it dies before it listens, with `Error: Denied ID …/scripts/employee-bootstrap.mjs?raw`. `vite build` resolves the same import without complaint, so CI and every deploy are fine.

`app/vite.config.ts` names the repo root in `server.fs.allow`. The failure only shows when Vite re-examines dependencies — the first start after the lockfile changes — so it looks like a new package broke the server when it did not. The same [test](../../app/src/local-dev.test.ts) checks the allowance is still there.

## When the scan is a black rectangle

The room scan is loaded as a level-of-detail tree, and Spark draws such a mesh only through its LOD path. With `enableLod` off on the renderer, the view is empty, nothing is fetched and nothing is said: [level of detail in the scan](../stack/level-of-detail.md) has the whole account. If the scan ever goes black again, that is the first thing to check, before the file or the GPU.

Part of [development](README.md).
