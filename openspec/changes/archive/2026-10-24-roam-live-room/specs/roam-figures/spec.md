# roam-figures Specification

## ADDED Requirements

### Requirement: A person stands in the room
The ROAM viewer SHALL draw each other person in the scan at the position and facing that person reports, standing on the floor height derived from the scan's own recorded camera heights, upright and turned toward the viewer wherever the viewer looks from.

#### Scenario: Look at someone from above
- **WHEN** the viewer moves to the top or overview camera and looks down at a person
- **THEN** that person stays upright and visible, rather than tipping away or disappearing edge-on

#### Scenario: Their video has not arrived
- **WHEN** a person is in the room but their camera has not come through
- **THEN** a plain figure is drawn in their place, and their position, facing, voice and selection behave no differently

### Requirement: A person moves as they move
A figure SHALL follow the positions its person reports, moving smoothly between them rather than stepping, and SHALL stop existing when that person leaves.

#### Scenario: Watch someone cross the room
- **WHEN** another person walks across their own view of the room
- **THEN** their figure moves across the scan without visible stepping between reported positions

### Requirement: Click a person to watch them
The viewer SHALL fill the view with a person's video when the viewer clicks that person, SHALL return to the room when it is closed, and SHALL restore the camera to the position and direction it had when watching began.

#### Scenario: Watch and come back
- **WHEN** the viewer clicks a person and then closes the view
- **THEN** the room is shown again from exactly the position and direction the viewer was at before the click

#### Scenario: Click empty space
- **WHEN** the viewer clicks the scene where nobody is
- **THEN** nothing is watched and the scene keeps the keyboard focus for movement
