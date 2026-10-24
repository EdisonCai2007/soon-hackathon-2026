## ADDED Requirements

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
