# roam-spatial-audio Specification

## ADDED Requirements

### Requirement: A figure's voice comes from where it stands
Each figure's sound SHALL be played through the viewer's position and facing, growing louder as the distance between them falls and shifting between the viewer's left and right as the direction to the figure changes, updated as the viewer moves.

#### Scenario: Walk toward the figure
- **WHEN** the viewer moves closer to a figure
- **THEN** that figure's voice grows louder, and turning so the figure is to one side moves its voice to that side

#### Scenario: A figure across the room
- **WHEN** a figure is at the far side of the scanned space
- **THEN** its voice is faint rather than silent, so the viewer can tell where to walk

### Requirement: Sound waits for the first click
The app SHALL start no sound until the person's first click on the page, SHALL show that sound is off until it is running, and SHALL stop showing that once it is.

#### Scenario: Open the page and click
- **WHEN** the page opens and the person has not yet clicked it
- **THEN** the page shows that sound is off, and the first click on the scene starts the sound and removes that notice
