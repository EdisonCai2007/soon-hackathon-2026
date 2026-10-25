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

### Requirement: The view keeps a usable frame rate
The viewer SHALL watch how fast it is drawing and SHALL give up detail — drawing fewer and larger splats, and filling fewer pixels — until the view is smooth enough to look at, rather than stuttering at full detail. It SHALL leave a machine that is keeping up drawing exactly what it draws today, SHALL ignore the first moments of drawing, during which the scan is still being prepared, and SHALL NOT raise the detail again within a session.

#### Scenario: A machine that keeps up
- **WHEN** the view holds a smooth frame rate at full detail
- **THEN** every splat is drawn, as it is today, and nothing about the view changes

#### Scenario: A machine that cannot
- **WHEN** the view stays too slow to look at for a few seconds
- **THEN** less of the scan is drawn until it is smooth again, with no question asked of the person and nothing said on screen

#### Scenario: A moment of slowness
- **WHEN** the view is slow only while the scan is first being prepared, or for a moment
- **THEN** the detail is left alone

### Requirement: First-person movement
The viewer SHALL move with W/A/S/D on the horizontal plane and Q/E vertically, with Shift for faster movement, and SHALL turn in place on drag without changing the camera's position. On a screen that is touched, the viewer SHALL also offer a movement control under a thumb, so that a person with no keyboard can move through the scan as well as look around it; that control SHALL move the camera the same way and at the same speed the keys do.

#### Scenario: Look without moving
- **WHEN** the person drags the scene with no movement key held
- **THEN** the camera's orientation changes and its position stays the same

#### Scenario: Focus is lost
- **WHEN** the page loses focus while a movement key is held, or the key press started in a form field
- **THEN** the camera does not move until a fresh key press on the scene

#### Scenario: Moving on a phone
- **WHEN** a person on a touch screen presses and holds the movement control towards one side
- **THEN** they move through the scan in that direction for as long as they hold it, and dragging elsewhere still turns the view

#### Scenario: The movement control is not a press on the room
- **WHEN** a press begins on the movement control and finishes over a person or a marker in the view
- **THEN** nothing is opened or watched: the press moved them and did nothing else

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
