# Tasks

## 1. Place the new clips

- [x] 1.1 Compress the fireplace and chairs clips and the new couch export into `app/public/apps/roam/`; verify each is under 25 MiB with its animation intact (`gltf-transform inspect`).
- [x] 1.2 List every clip in `CLIPS` in `people.ts`, placed by Edison's copied spots, and load them together; verify in the local app from *Lobby night video 162.1s* (fireplace), *Lobby video 5.9s* (desk) and *Lobby video 16.4s* (couch).
- [x] 1.3 Skip the cornea in each model's eye material; verify in the eye mesh that the eyeball's front maps to the texture's pupils.

## 2. Verification

- [x] 2.1 `npx vitest run --coverage` covers every clip's placement, looping and the eyes at 100%, and `/save` passes its checks.
