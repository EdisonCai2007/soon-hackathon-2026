## MODIFIED Requirements

### Requirement: A person stands in the room
The ROAM viewer SHALL draw each other person in the scan as a body — a head, a torso below it, and a hand on each side — standing on the floor height derived from the scan's own recorded camera heights, at the position that person reports and no taller than the single figure it replaces. The body and hands SHALL be turned to the facing that person reports, while the person's video SHALL be shown on the head's face, kept turned toward the viewer and clear of the head from every angle.

#### Scenario: Look at someone from above
- **WHEN** the viewer moves to the top or overview camera and looks down at a person
- **THEN** that person's body stays upright and whole, and their face is still turned toward the viewer rather than tipping away or disappearing edge-on

#### Scenario: Walk around behind someone
- **WHEN** the viewer walks around a person who is facing elsewhere
- **THEN** the body and hands stay turned the way that person is facing, and their face turns to follow the viewer without ever sinking into the head

#### Scenario: Their video has not arrived
- **WHEN** a person is in the room but their camera has not come through
- **THEN** their whole body is drawn in their own colour, and their position, facing, voice and selection behave no differently

## ADDED Requirements

### Requirement: Hands move with the person
A person's hands SHALL swing in step with the distance that person travels, opposite one another, coming to rest when they stop and never leaving the body's sides.

#### Scenario: Watch someone walk past
- **WHEN** another person crosses the room and then stands still
- **THEN** their hands swing as they travel and settle once they stop, rather than hanging fixed the whole way
