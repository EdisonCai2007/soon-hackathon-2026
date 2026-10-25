## MODIFIED Requirements

### Requirement: First-person movement
The viewer SHALL move with W/A/S/D on the horizontal plane and Q/E vertically, with Shift for faster movement, and SHALL turn in place on drag without changing the camera's position. On a screen that is touched, the viewer SHALL also offer a movement control under a thumb, so that a person with no keyboard can move through the scan as well as look around it; that control SHALL move the camera the same way and at the same speed the keys do. The viewer MAY additionally shift the drawn view by a small amount to follow where the viewer's own head is, where the person has asked for it; that shift SHALL be a shift of what is drawn only, and SHALL NOT change the place the viewer is reported to be standing.

#### Scenario: Look without moving
- **WHEN** the person drags the scene with no movement key held
- **THEN** the camera's orientation changes and its position stays the same

#### Scenario: Focus is lost
- **WHEN** the page loses focus while a movement key is held, or the key press started in a form field
- **THEN** the camera does not move until a fresh key press on the scene

#### Scenario: Moving on a phone
- **WHEN** a person on a touch screen presses and holds the movement control towards one side
- **THEN** they move through the scan in that direction for as long as they hold it, and dragging elsewhere still turns the view

#### Scenario: The movement control is not a press on the room
- **WHEN** a press begins on the movement control and finishes over a person in the view
- **THEN** nothing is opened or watched: the press moved them and did nothing else

#### Scenario: Leaning towards the view
- **WHEN** the person has asked the view to follow their head and they lean to one side
- **THEN** the drawn view shifts a little the other way, as a window would, and the place others see them standing in does not change
