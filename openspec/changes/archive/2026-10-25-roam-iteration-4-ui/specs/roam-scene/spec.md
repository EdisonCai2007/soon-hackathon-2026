## ADDED Requirements

### Requirement: Placing tools stay out of the way
The viewer SHALL show its placing tools — the scan's splat and view counts, the choice of each source-video camera, and where the camera is — only when the app's address asks for them with `?tools`. The app's plain address, and every room link, SHALL show none of them.

#### Scenario: A visitor walks the room
- **WHEN** a person opens ROAM or a room's link as shared
- **THEN** they see the views, who's in, sound, full screen and the directions, and no counts, camera choice or position

#### Scenario: Edison places a model
- **WHEN** a person opens ROAM with `?tools` on its address
- **THEN** the counts, the camera choice and the camera's position with Copy all show, and each works as before

## MODIFIED Requirements

### Requirement: Scan renders on the site
The ROAM app at `/apps/roam/` SHALL load the compressed Gaussian-splat room scan from the site's own static assets, with no external CDN, and render it oriented by the scene metadata's rotation and translation.

#### Scenario: Open ROAM
- **WHEN** a person opens `/apps/roam/` on a preview or the live site
- **THEN** the scanned room renders from the first source-camera view, and with the placing tools shown the page states the splat and view counts

#### Scenario: Scan cannot load
- **WHEN** the scan or its metadata fails to load, or the browser has no WebGL
- **THEN** the page shows a plain message and, for a failed load, a *Try again* action, instead of a blank canvas

### Requirement: Camera presets
The viewer SHALL offer Room view, Overview and Top view, and, with the placing tools shown, a choice of each source-video camera, each placing the camera at a known position computed from the scene metadata.

#### Scenario: Jump to a source camera
- **WHEN** the person, with the placing tools shown, picks a source camera
- **THEN** the camera moves to that camera's recorded position, direction, and field of view, and later movement starts from there

### Requirement: Where the camera is
With the placing tools shown, the viewer SHALL show the camera's current position and facing direction in the scan's viewer coordinates, the same coordinates as the source-video cameras, kept current while the person moves, and SHALL offer an action that copies them as text.

#### Scenario: Copy a position
- **WHEN** the person walks to a spot, then chooses Copy
- **THEN** the clipboard holds that spot's position and facing, and jumping to the copied spot from them shows the same view

#### Scenario: Before the room loads
- **WHEN** the scan has not finished loading
- **THEN** no position is shown and Copy is unavailable
