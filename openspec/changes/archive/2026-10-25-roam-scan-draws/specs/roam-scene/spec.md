## ADDED Requirements

### Requirement: View presets
The viewer SHALL offer Room view, Overview and Top view, each placing the camera at a known position computed from the scene metadata.

#### Scenario: Jump to a preset
- **WHEN** the person picks Room view, Overview or Top view
- **THEN** the camera moves to that preset's position, and later movement starts from there

## MODIFIED Requirements

### Requirement: Scan renders on the site
The ROAM app at `/apps/roam/` SHALL load the compressed Gaussian-splat room scan from the site's own static assets, with no external CDN, and render it oriented by the scene metadata's rotation and translation, at every detail step the viewer uses.

#### Scenario: Open ROAM
- **WHEN** a person opens `/apps/roam/` on a preview or the live site
- **THEN** the scanned room renders from the first source-camera view

#### Scenario: A laptop at full detail
- **WHEN** a laptop draws the scan at its first, fullest detail step
- **THEN** the room is drawn, not a dark view with only the people in it

#### Scenario: Scan cannot load
- **WHEN** the scan or its metadata fails to load, or the browser has no WebGL
- **THEN** the page shows a plain message and, for a failed load, a *Try again* action, instead of a blank canvas

## REMOVED Requirements

### Requirement: Camera presets
**Reason**: The choice of each source-video camera went with the placing tools; the three views stay as View presets.
**Migration**: None.

### Requirement: Where the camera is
**Reason**: Edison asked for the placing tools removed.
**Migration**: None; positions are read from the code or the scene file.

### Requirement: Placing tools stay out of the way
**Reason**: The placing tools are gone, so `?tools` shows nothing.
**Migration**: None.
