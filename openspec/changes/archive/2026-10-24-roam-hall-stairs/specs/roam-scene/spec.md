## ADDED Requirements

### Requirement: Where the camera is
The viewer SHALL show the camera's current position and facing direction in the scan's viewer coordinates, the same coordinates as the source-video cameras, kept current while the person moves, and SHALL offer an action that copies them as text.

#### Scenario: Copy a position
- **WHEN** the person walks to a spot, then chooses Copy
- **THEN** the clipboard holds that spot's position and facing, and jumping to the copied spot from them shows the same view

#### Scenario: Before the room loads
- **WHEN** the scan has not finished loading
- **THEN** no position is shown and Copy is unavailable
