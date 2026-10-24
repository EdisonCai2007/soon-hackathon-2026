## ADDED Requirements

### Requirement: People appear as cut-out figures placed in the scan
The viewer SHALL show each person as an upright, background-removed video figure at their reported position in the scan, facing the viewer, and SHALL move the figure as their position changes.

#### Scenario: A person moves through the room
- **WHEN** a figure's reported position changes
- **THEN** the figure moves to the matching place in the scan, staying upright and facing the viewer

#### Scenario: A figure's position or video drops
- **WHEN** a figure's position or video stops arriving
- **THEN** the figure holds its place with a clear reconnecting marker instead of jumping to a wrong location

### Requirement: A scripted stand-in guarantees the demo
ROAM SHALL include a scripted figure that plays a prepared cut-out video along a set path near the recorded camera route, with no network or phone.

#### Scenario: Demo with no phone or network
- **WHEN** the viewer opens ROAM with no live participants
- **THEN** the scripted figure walks its path through the room with its voice, using the same placement as a live figure

### Requirement: Watch a person up close
The viewer SHALL let a person click a figure to watch its video full screen, and closing it SHALL return the camera to where it was.

#### Scenario: Select and return
- **WHEN** a person clicks a figure, then closes the full-screen video
- **THEN** the video fills the screen, and on close the room view returns to the same position and facing

### Requirement: The 3D view can fill the screen
The viewer SHALL offer a full-screen mode for the 3D view, and SHALL stay responsive while figures and audio play, lowering splat detail before input lags.

#### Scenario: Present on a projector
- **WHEN** a person presses Full screen
- **THEN** the 3D view fills the display, and Escape returns to the app's frame
