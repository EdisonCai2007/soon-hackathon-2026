# roam-capture Specification

## Purpose
TBD - created by archiving change roam-live-room. Update Purpose after archive.
## Requirements
### Requirement: A phone in the room reports its own position
The phone page SHALL stream its camera into the room and SHALL take its position from the phone's own movement tracking, so that walking the real room moves that person through the scan. ROAM SHALL NOT work the position out from the picture the camera sends.

#### Scenario: Be the camera
- **WHEN** a person opens the room's link on a supported Android phone, lines up, and goes live
- **THEN** their camera and position stream into the room, and the others see them at the place they are standing

#### Scenario: The phone cannot track
- **WHEN** the phone's browser offers no movement tracking, as on an iPhone
- **THEN** the page says so plainly and offers to join as an ordinary guest instead

### Requirement: Lining up once ties the phone to the scan
The phone page SHALL line the phone's tracking up with the scan from one known spot in the real room, confirmed by the person, and SHALL refuse to go live until that is done.

#### Scenario: Stand on the spot
- **WHEN** the person stands on the marked spot facing the marked direction and confirms
- **THEN** their position locks to the matching place in the scan, and the phone's own tracking keeps them placed as they walk

#### Scenario: Not lined up yet
- **WHEN** the person tries to go live before confirming the spot
- **THEN** the page asks them to line up first instead of placing them somewhere wrong

