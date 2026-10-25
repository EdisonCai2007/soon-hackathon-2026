## ADDED Requirements

### Requirement: The lobby is whole
The ground floor SHALL include the whole lobby, the party room behind the stairs as well as the living room, with its walls, ceiling and floor shown without gaps and without the colour of the party lights it was filmed under. Adding the party room SHALL leave the living room, hallway and stairs as they were.

#### Scenario: Walk into the party room
- **WHEN** the person picks a *Lobby night video* camera from the camera choice
- **THEN** the camera stands in the party room, its walls read white, and the floor runs unbroken under the tables and chairs

#### Scenario: The living room is untouched
- **WHEN** the person picks a *Lobby video* camera in the living room
- **THEN** the living room looks as it did before the party room was added

### Requirement: Filmed people play in the scan
The scan SHALL show the animated clip of Edison and a friend in the living room, Edison standing at his chosen spot and facing his chosen way and the friend seated beside him, both on the floor under them at the scan's scale, replaying the clip without end. A clip that fails to load SHALL leave the scan as it was.

#### Scenario: Watch the couch
- **WHEN** the person looks at the living-room couch
- **THEN** both people are there, moving, and the clip starts again each time it ends

#### Scenario: The clip fails to load
- **WHEN** the people model cannot be fetched
- **THEN** the room still loads and can be walked
