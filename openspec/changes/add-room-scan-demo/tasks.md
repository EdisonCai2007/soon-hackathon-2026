# Tasks

## 1. Scan and viewer

- [x] 1.1 Import the cleaned PLY, scene metadata, comparison buffers, pinned vendor modules, and license texts; verify required local files exist and the original source footage and model weights are absent.
- [x] 1.2 Import first-person controls and movement tests; verify `node --test experiments/room-scan/pov-controls.test.mjs` passes all six tests.
- [x] 1.3 Document local serving, controls, processing measurements, and limitations in the experiment README; verify the viewer renders and POV drag changes the viewing direction in the browser.

## 2. Processing handoff

- [x] 2.1 Parameterize the geometry, preparation, and export scripts with explicit input/output paths; verify Python compilation and search for accidental machine-specific paths.
- [x] 2.2 Include pinned upstream revisions and the tested compatibility patches; verify patch files and processing commands match the original run.

## 3. Review and draft delivery

- [x] 3.1 Run the repository pre-check and record its result; validate this change with OpenSpec and generate its review page.
- [x] 3.2 Commit and push the named feature branch; create and verify a draft PR targeting main without merging it.
