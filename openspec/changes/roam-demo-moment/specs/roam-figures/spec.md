# roam-figures Specification

## ADDED Requirements

### Requirement: A figure stands in the room
The ROAM viewer SHALL place each figure in the scan at a position and facing supplied by a figure source, standing on the floor height derived from the scan's recorded camera heights, and SHALL keep the figure upright and turned toward the viewer's position regardless of where the viewer looks from.

#### Scenario: Look at the figure from above
- **WHEN** the viewer moves to the top or overview camera and looks down at the figure
- **THEN** the figure stays upright and visible, rather than tipping away or disappearing edge-on

#### Scenario: No clip is available
- **WHEN** the figure has no prepared video to show
- **THEN** a plain placeholder figure is drawn in its place and every other behaviour — its position, facing, voice, and selection — is unchanged

### Requirement: The figure walks the filmed route
A figure driven by the scripted source SHALL move at a steady speed along a closed path built from the scan's source-camera positions, facing its direction of travel, and SHALL repeat that path for as long as the page is open.

#### Scenario: Watch the figure cross the room
- **WHEN** the room has loaded and the viewer stands still
- **THEN** the figure moves between the places the room was filmed from, without stopping and without leaving the scanned space

### Requirement: Click a figure to watch it
The viewer SHALL show a figure's video filling the view when the person clicks that figure, SHALL return to the room when the person closes it, and SHALL restore the camera to the position and direction it had when watching began.

#### Scenario: Watch and come back
- **WHEN** the person clicks a figure and then closes the view
- **THEN** the room is shown again from exactly the position and direction the person was at before the click

#### Scenario: Click empty space
- **WHEN** the person clicks the scene where no figure is
- **THEN** nothing is watched and the scene keeps the keyboard focus for movement
