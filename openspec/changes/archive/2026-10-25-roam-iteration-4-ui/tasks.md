# Tasks

## 1. The board's look

- [x] 1.1 Add ROAM's colours and fonts to `app/src/index.css` and the two font packages; verify `npm run build:app` passes.
- [x] 1.2 Build the pills (`pill-look.ts`, `Pill.tsx`) with red edges, blue or red hover fills and the pointer cursor, and the full-window `Screen` with `Wordmark`; verify on the local dev server that ROAM covers the workspace bar and the other pages keep it.
- [x] 1.3 Restyle `Scan`, `Host`, `Join`, `Phone`, `Room` and `Watch`: views and *who's in* top centre, sound and full screen top right, *who's in* as a dropdown, plain white directions; verify `Room.test.tsx` opens, closes and removes through the dropdown.
- [x] 1.4 Draw the moving screentone (`halftone.ts`, `Halftone`); verify `halftone.test.ts` and `Screen.test.tsx` cover coverage, reshaping, resizing, reduced motion and no-canvas browsers.

## 2. Placing tools behind `?tools`

- [x] 2.1 Move the counts, camera choice and position line into `Tools.tsx`, shown only when `toolsOn()` reads `?tools`; verify `App.test.tsx` finds none of them at the plain address and all of them, working, with `?tools`.

## 3. Verification

- [x] 3.1 ROAM's tests keep every ROAM file at 100% coverage, and lint, typecheck, knip and jscpd pass on this computer; CI is the gate at `/save`.
