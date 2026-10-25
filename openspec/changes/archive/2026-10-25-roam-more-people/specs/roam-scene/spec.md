## MODIFIED Requirements

### Requirement: Filmed people play in the scan
The scan SHALL show Edison's animated clips of people, each pair at its chosen place on the ground floor: two on the living-room couch, two in front of the living-room fireplace, and two seated by the white desk under the stairs. Each person SHALL stand or sit on the floor under them at the scan's scale, near the spot and facing Edison chose, every clip SHALL replay without end, and every clip SHALL be present whichever camera the person picks. The models' eyes SHALL show iris and pupil. A clip that fails to load SHALL leave the scan as it was.

#### Scenario: Watch the couch
- **WHEN** the person looks at the living-room couch
- **THEN** both people are there, moving, and the clip starts again each time it ends

#### Scenario: Walk past the fireplace and the desk
- **WHEN** the person walks from the stairs past the white desk into the living room
- **THEN** the seated pair is by the desk and the standing pair is in front of the fireplace, both moving

#### Scenario: Look someone in the eye
- **WHEN** the person stands close to a model's face
- **THEN** its eyes show a coloured iris with a dark pupil, not a blank white

#### Scenario: The clip fails to load
- **WHEN** the people model cannot be fetched
- **THEN** the room still loads and can be walked
