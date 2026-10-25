# roam-scene Specification

## Purpose
TBD - created by archiving change roam-scan-on-site. Update Purpose after archive.

## Requirements

### Requirement: Scan renders on the site
The ROAM app at `/apps/roam/` SHALL load the compressed Gaussian-splat room scan from the site's own static assets, with no external CDN, and render it oriented by the scene metadata's rotation and translation.

#### Scenario: Open ROAM
- **WHEN** a person opens `/apps/roam/` on a preview or the live site
- **THEN** the scanned room renders from the first source-camera view, and the page states the splat and view counts

#### Scenario: Scan cannot load
- **WHEN** the scan or its metadata fails to load, or the browser has no WebGL
- **THEN** the page shows a plain message and, for a failed load, a *Try again* action, instead of a blank canvas

### Requirement: First-person movement
The viewer SHALL move with W/A/S/D on the horizontal plane and Q/E vertically, with Shift for faster movement, and SHALL turn in place on drag without changing the camera's position.

#### Scenario: Look without moving
- **WHEN** the person drags the scene with no movement key held
- **THEN** the camera's orientation changes and its position stays the same

#### Scenario: Focus is lost
- **WHEN** the page loses focus while a movement key is held, or the key press started in a form field
- **THEN** the camera does not move until a fresh key press on the scene

### Requirement: Camera presets
The viewer SHALL offer Room view, Overview, Top view, and a choice of each source-video camera, each placing the camera at a known position computed from the scene metadata.

#### Scenario: Jump to a source camera
- **WHEN** the person picks a source camera
- **THEN** the camera moves to that camera's recorded position, direction, and field of view, and later movement starts from there

### Requirement: Scan fits the host
Every ROAM asset SHALL be smaller than Cloudflare's 25 MiB static-asset file limit.

#### Scenario: Build the app
- **WHEN** the app is built for deployment
- **THEN** every file under the ROAM asset folder is under 25 MiB

### Requirement: The room can fill the screen
The ROAM viewer SHALL offer an action that makes the room view fill the whole screen and return to the page, keeping the view's own controls reachable while it is filled.

#### Scenario: Show the room on a projector
- **WHEN** the person chooses to fill the screen
- **THEN** the room view fills the display, its controls stay usable, and leaving full screen restores the page with the camera where it was

### Requirement: The address can carry a room
The ROAM app's address SHALL be able to name a room and a joiner's role, so that one link is everything a person needs to arrive in the right place. The app's plain address SHALL keep walking the scan alone.

#### Scenario: Open the app with no room
- **WHEN** a person opens the app's own address with no room in it
- **THEN** they walk the scanned room by themselves, exactly as they did before rooms existed

### Requirement: The scan covers both floors
The scan SHALL include the upstairs rooms and the floor below, joined by the staircase, with the source-video cameras of every floor offered as camera presets, and SHALL show no people captured in the source videos. A figure in a shared room SHALL stand on the floor under it.

#### Scenario: Go downstairs
- **WHEN** the person picks a stairs, hallway or lobby camera from the camera choice
- **THEN** the camera moves to that spot on the lower floor, and walking from there reaches the stairs back up

#### Scenario: Look for people
- **WHEN** the person walks the lobby, where people were present while it was filmed
- **THEN** no person appears in the scan

#### Scenario: A guest downstairs
- **WHEN** a guest in a shared room stands on the lower floor
- **THEN** their figure stands on the lower floor at the same size as a figure upstairs

### Requirement: Where the camera is
The viewer SHALL show the camera's current position and facing direction in the scan's viewer coordinates, the same coordinates as the source-video cameras, kept current while the person moves, and SHALL offer an action that copies them as text.

#### Scenario: Copy a position
- **WHEN** the person walks to a spot, then chooses Copy
- **THEN** the clipboard holds that spot's position and facing, and jumping to the copied spot from them shows the same view

#### Scenario: Before the room loads
- **WHEN** the scan has not finished loading
- **THEN** no position is shown and Copy is unavailable

### Requirement: The lobby is whole
The ground floor SHALL include the whole lobby, the party room behind the stairs as well as the living room, with its walls, ceiling and floor shown without gaps and without the colour of the party lights it was filmed under. Adding the party room SHALL leave the living room, hallway and stairs as they were.

#### Scenario: Walk into the party room
- **WHEN** the person picks a *Lobby night video* camera from the camera choice
- **THEN** the camera stands in the party room, its walls read white, and the floor runs unbroken under the tables and chairs

#### Scenario: The living room is untouched
- **WHEN** the person picks a *Lobby video* camera in the living room
- **THEN** the living room looks as it did before the party room was added

### Requirement: Filmed people play in the scan
The scan SHALL show Edison's animated clips of people, each at its chosen place: two on the living-room couch, two in front of the living-room fireplace, two seated by the white desk under the stairs, and one man doing jumping jacks in the old bedroom upstairs. Each person SHALL stand or sit on the floor under them at the scan's scale, near the spot and facing Edison chose, every clip SHALL replay without end, and every clip SHALL be present whichever camera the person picks. The models' eyes SHALL show iris and pupil. A clip that fails to load SHALL leave the scan as it was.

#### Scenario: Watch the couch
- **WHEN** the person looks at the living-room couch
- **THEN** both people are there, moving, and the clip starts again each time it ends

#### Scenario: Walk past the fireplace and the desk
- **WHEN** the person walks from the stairs past the white desk into the living room
- **THEN** the seated pair is by the desk and the standing pair is in front of the fireplace, both moving

#### Scenario: Open the page
- **WHEN** the page opens on its first camera, in the old bedroom
- **THEN** the man doing jumping jacks is in view beside the bed, moving

#### Scenario: Look someone in the eye
- **WHEN** the person stands close to a model's face
- **THEN** its eyes show a coloured iris with a dark pupil, not a blank white

#### Scenario: The clip fails to load
- **WHEN** the people model cannot be fetched
- **THEN** the room still loads and can be walked

### Requirement: Filmed people stay whole up close
Every part of a filmed person SHALL be drawn whenever it is in view, however far the person's animation has moved them from where their clip starts.

#### Scenario: Walk up to a face
- **WHEN** the person stands close to a model's face after the model has walked away from its starting spot
- **THEN** its hair, eyes, eyebrows and mouth are all drawn
