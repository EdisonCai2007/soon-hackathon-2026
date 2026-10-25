## ADDED Requirements

### Requirement: The room relays what somebody cast
A room SHALL pass on a person's cast to everyone else in it, naming who cast it and which technique, so that every page draws the same thing around the same person. It SHALL refuse a cast naming a technique it does not know, and SHALL refuse one sent sooner than the wait between casts allows, relaying nothing and disconnecting nobody.

#### Scenario: A cast reaches the room
- **WHEN** a person in a room casts a known technique, having waited since their last one
- **THEN** everyone else in the room is told who cast it and which technique it was

#### Scenario: A cast that is not allowed
- **WHEN** a page sends a cast with an unknown technique, or sends one sooner than the wait allows
- **THEN** nothing is relayed, the sender stays connected, and everybody else in the room is unaffected
