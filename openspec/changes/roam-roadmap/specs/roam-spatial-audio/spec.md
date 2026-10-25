## ADDED Requirements

### Requirement: The viewer hears figures in space
Each figure's voice SHALL be placed from the viewer's position and facing: louder up close, fainter with distance, and panned toward the figure's side, updating continuously as the viewer moves.

#### Scenario: Walk past a figure
- **WHEN** the viewer walks past a speaking figure from one side to the other
- **THEN** its voice grows louder on approach and sweeps across the stereo field as the viewer passes

### Requirement: Sound starts on the first click
Because browsers block audio until a person interacts, the viewer SHALL show that sound is off and SHALL start audio on the first click or tap.

#### Scenario: First interaction unlocks sound
- **WHEN** a person first clicks the scene
- **THEN** spatial audio starts, and before that a visible marker says sound is waiting on a click

### Requirement: One lost voice leaves the others playing
Losing one figure's audio SHALL NOT interrupt the others; a muted or absent stream SHALL contribute no sound.

#### Scenario: One stream drops
- **WHEN** one figure's audio stops
- **THEN** the remaining figures stay audible and correctly placed
