# roam-spatial-audio Specification

## Purpose
TBD - created by archiving change roam-live-room. Update Purpose after archive.
## Requirements
### Requirement: A voice comes from where its person stands
The viewer SHALL place each person's voice by distance and direction from the viewer's own position and facing: quiet far away, loud up close, and to the side the person is on. A distant voice SHALL stay faint rather than silent, so the viewer can tell which way to walk.

#### Scenario: Walk toward someone who is talking
- **WHEN** the viewer walks toward a person and then turns on the spot
- **THEN** that person's voice grows as the distance closes and moves between the viewer's ears as they turn

### Requirement: Sound waits for the first press, and says so
The viewer SHALL start sound only after the person's first press on the page, as browsers require, and SHALL show that sound is off until it is running.

#### Scenario: Sound is still blocked
- **WHEN** the room has loaded and the person has not pressed anything yet
- **THEN** the page shows that sound is off, and the notice goes once the first press starts the sound

