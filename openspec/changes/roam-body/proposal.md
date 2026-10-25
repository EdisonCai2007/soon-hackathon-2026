# The people in the room get a body

**Status:** planned
**Branch:** roam-body
**Open questions:** none

## Why

Everyone in the scanned home is a floating rectangle with their camera on it. It works, but it reads as a video call pinned to a wall rather than a person standing in a room: you cannot tell which way someone is turned, whether they are moving, or that there is a person there at all until their camera arrives. Giving each person a simple body — a head with their face on it, a torso, and two hands — makes the room feel occupied, and it is the shape a headset person will slot straight into when hands become real.

## What Changes

- **Everyone in the room gets a body instead of a flat rectangle.** A head with their camera on its front, a chunky torso under it, and two hands floating where arms would be. No arms, no legs: the shape people already know from VR. The body is as tall as the rectangle was, stands on the same floor, and is the same colour as that person's name.
  ```svg
  <svg viewBox="0 0 230 120">
    <text x="6" y="14">now</text>
    <rect x="18" y="22" width="36" height="82" fill="card" stroke="line"/>
    <text x="22" y="48">face</text>
    <path d="M6 104h66" stroke="subtle" fill="none"/>
    <text x="150" y="14">after</text>
    <rect x="164" y="22" width="28" height="28" fill="card" stroke="line"/>
    <text x="167" y="40">face</text>
    <rect x="160" y="56" width="36" height="34" fill="card" stroke="line"/>
    <rect x="144" y="62" width="13" height="13" fill="card" stroke="line"/>
    <rect x="199" y="62" width="13" height="13" fill="card" stroke="line"/>
    <path d="M140 104h76" stroke="subtle" fill="none"/>
  </svg>
  ```

- **Their face stays turned to you, even when they are looking away.** The body and hands turn the way the person is really facing, so you can see who is looking at what. The face itself keeps turning to you, so you can always tell who someone is. It is a small lie, and it is the one that makes a room full of people readable.
  ```svg
  <svg viewBox="0 0 220 86">
    <text x="6" y="14">from above</text>
    <circle cx="70" cy="46" r="18" fill="card" stroke="line"/>
    <path d="M70 46V18m-5 7 5-7 5 7" stroke="muted" fill="none"/>
    <text x="24" y="80">they look away</text>
    <path d="M88 52h44" stroke="line" fill="none"/>
    <path d="M56 58h28" stroke="fg" fill="none"/>
    <text x="142" y="56">you</text>
    <text x="122" y="80">face turns to you</text>
  </svg>
  ```

- **Their hands swing as they walk.** Nobody in a room is wearing a headset yet, so nothing knows where a person's real hands are. The hands swing in step with how far that person actually moves and settle when they stop, so a figure crossing the room looks like it is walking rather than sliding.

- **Nothing else about the room changes.** The same voices from the same places, the same click to watch someone full-size, the same number of people, and not one extra thing sent between browsers — the body is drawn from the position and facing each person already reports ten times a second.

- **Real hands come next, not here.** Joining from a headset is its own change, and when it lands it fills in these same two hands; nothing else about the body will move.

Non-goals: no way to join from a headset, no arms or legs, no faces for people whose camera has not arrived beyond the coloured body they get today, and nothing new on the wire.

## Capabilities

### Modified Capabilities

- `roam-figures`: a person is drawn as a head, torso and hands rather than one upright rectangle; the body turns to the person's own facing while the face keeps turning to the viewer; and the hands swing with the distance the person travels.

## Impact

- `app/src/apps/roam/placement.ts` gains the rig's proportions, all derived from the existing `figureSize` height, plus the pure functions for where the face sits and how far the hands have swung.
- `app/src/apps/roam/stage.ts` builds a `Group` per person instead of one `Mesh` — head, torso, two hands, and the video plane — moves its parts each frame, picks against all of them, and disposes them together. The voice moves from the rectangle's middle to the head.
- `app/src/apps/roam/stage.test.ts` and `placement.test.ts` cover the new shapes and motion; `RoomViewer.test.tsx` reads the figure's height and needs its expectations matched to the new parts.
- No new packages, no message or schema change, no stored data, nothing to undo.

## Decision log

- **2026-10-24** — Asked what the body should be made of → chose a head, a torso and two floating hands, the usual VR shape, with no arms and no legs.
- **2026-10-24** — Asked which way the body should face → chose the body turning to the person's own facing while the face keeps turning to the viewer, so a room stays readable from any angle.
- **2026-10-24** — Asked what the hands should do → chose real hands sent from a headset.
- **2026-10-24** — Asked how much that should take on, given no headset can join the room today → chose the body first with swinging hands, and headset joining as its own later change that fills in the same hands.
- **2026-10-24** — Asked what the hands of someone on a laptop or phone should do → chose swinging as they move, so everyone looks alive and a headset person simply looks more real.
- **2026-10-24** — Asked how much of a headset hand others should see, when that change comes → chose where the hand is, one block each, not fingers: it matches the blocky look and costs almost nothing to send.
- **2026-10-24** — Assumed: the body is the height the rectangle is today, with every part a fraction of it, because the scan is not in metres and that height is the one measurement the room already trusts.
- **2026-10-24** — Assumed: the face is a flat plane floating just clear of the head rather than painted on it, because a face painted on a turning head would be hidden half the time, and a plane inside the head would cut through it.
- **2026-10-24** — Assumed: a person whose camera has not arrived gets the whole body in their colour, exactly as the rectangle is coloured today.
- **2026-10-24** — Assumed: clicking any part of a body watches that person, as clicking anywhere on the rectangle does now.
- **2026-10-24** — Assumed: the hands drift very slightly when a person stands still, because hands frozen mid-air read as a frozen page.
- **2026-10-24** — Assumed: a person's voice now comes from their head rather than the middle of their rectangle, which is a few inches higher and closer to where a voice belongs.
- **2026-10-24** — Found while this plan waited, and the plan changed for it: notes left in the home landed in the same file, so a press now says whether it hit a person or a note. Every part of a body reports the person, and the note markers are left exactly as they are.
