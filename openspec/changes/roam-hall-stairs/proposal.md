# Rebuild the upstairs hall and the stairs from the stairs video

**Status:** in-progress
**Branch:** roam-hall-stairs
**Open questions:** none

## Why

Walking the upstairs hall and down the stairs, the scan looked cluttered: smeared walls and stray blobs. The hall came from an earlier walk, and seen from the stairs video's own path it scored only 16–17 dB. Edison asked to rebuild just the hall and the stairs from that video, `IMG_1258.MOV`, and leave the bedrooms, the WC and the first floor as they are.

## What Changes

- **The upstairs hall and the stairs are rebuilt from the stairs video.** The hall runs from the old-bedroom door, past the WC, to the top of the stairs, then down to the first floor, as on Edison's floor plan. It is reconstructed from a frame every 0.25 s and trained at 1.5 times the usual image size.
  ```text
  held-out PSNR, dB        live   new
  hall to the WC           16.2   22.8
  WC to the stairs top     16.7   24.3
  stairs, top              23.0   25.7
  stairs, middle           22.9   24.8
  stairs, bottom           22.5   23.3
  older hall video         24.8   24.2
  bedrooms, WC, 1st floor  same, within 0.3
  ```
- **Head-height clutter between the hall and stairs walls is cleared.** 10,545 faint splats floating between the walls are removed, so walls and door edges read crisper when walking.
- **Two hanging clouds are cleared: over the foot of the old bed, and in the WC doorway.** Edison pointed at them, the second by its copied position; 2,512 and 4,685 faint splats, with walls and the headboard kept.
- **The viewer shows where you are, and copies it.** A line under the camera choice reads your position and the way you face, in the scan's own numbers, with a Copy button. Paste it into a chat to point at a spot in the scan exactly, such as clutter to remove.
  ```screen
  <div class="card col gap">
    <div class="row gap"><span class="muted">Camera</span><span class="tag-outline">Stairs video 19.4s</span><span class="grow"></span></div>
    <div class="row gap"><span class="muted">You are at</span><span class="tag">x 1.23 · y 0.31 · z -0.45</span><span class="muted">facing</span><span class="tag">0.71 · -0.10 · -0.70</span><button>Copy</button></div>
    <div class="bar">the scanned room</div>
  </div>
  ```
- **Every splat outside the hall and stairs is the live scan's, byte for byte.** Bedrooms, the WC and the first floor are not retrained.
- **The camera menu lists the stairs video's hall spots,** so the new hall is a click away.
- **Clicking a person works before the next frame is drawn.** Picking now uses where each figure stands, not where it was last drawn; the tests click before any frame, and a slightly shorter figure height exposed it.

Non-goals: no other room changes; no viewer changes beyond picking and the position line.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: the viewer shows the camera's position and facing and copies them. Picking now does what the live-room spec already says.

## Impact

- `app/public/apps/roam/room.spz` (12.6 MB, 595,196 splats) and `scene.json` (770 camera views); tests pinning the scan's counts and size.
- `app/src/apps/roam/stage.ts`: figures' positions are brought up to date before a pick.
- `app/src/apps/roam/RoomViewer.tsx` reports the camera's pose a few times a second; `Scan.tsx` shows it with a Copy button.
- `experiments/room-scan/pipeline/`: `region_swap.py`, `finetune.py --freeze-first`, `clear_air.py`, README *Replace one walk's space*.

## Decision log

- 2026-10-24: Trained the hall on both walks, not the stairs video alone. Alone it scored 25 dB on its own frames but cost the older hall video 5 dB, because each model looks worse from the other walk's viewpoints. The two walks agree within 2 cm and 2°, and correcting that offset gained only 0.5 dB, so it was left.
- 2026-10-24: The space is the hall and stairs near the walk's camera path that the walk's frames see. The far side of a shared wall stays the room's, so no room loses a wall. A seam fine-tune moves only the new splats; the 659,937 kept splats were checked identical afterwards.
- 2026-10-24: The stairs scores slightly favour the new model, which trained on some of the frames the older stairs model held out. The hall scores are fair: neither model trained on those frames.
- 2026-10-24: Cleared head-height air between the walls after Edison found it cluttered. It cost about 1 dB on the walk's held-out frames, but rendered off the walk the walls and door edges are crisper, so Edison kept it. Straight-ahead views stay soft because the video mostly points at the floor; Edison chose not to re-film.
- **2026-10-24** — Assumed: the position line is always shown, not hidden behind a setting, because it is one short line and Edison will use it to point at spots.
- **2026-10-24** — Assumed: it shows the camera's position and facing in the same viewer coordinates as `scene.json`'s cameras, not the point under the cursor, because the assistant can render the view from a camera pose, and the splat renderer gives no depth to pick a point with.
- **2026-10-24** — Assumed: it goes in this change, not a new one, because a second open plan on the branch would stop publishing.
- 2026-10-24: Cleared two clouds Edison pointed at: over the foot of the old bed, and one he gave by its copied position (x -0.395 y 0.109 z -0.400), which sits in the WC doorway. Splats within 15 cm of a solid surface, and anything near the headboard wall, were kept, because removing them opened holes. On their own held-out frames the old bedroom lost 1.5 dB and the WC 0.9 dB; walking, the clouds are gone.
- 2026-10-24: Saved with the hall and stairs, both clean-ups and the position line together, at Edison's request to save and ship what is there.
