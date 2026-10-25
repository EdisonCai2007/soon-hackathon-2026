## ADDED Requirements

### Requirement: The view keeps a usable frame rate
The viewer SHALL watch how fast it is drawing and SHALL give up detail — drawing fewer and larger splats, and filling fewer pixels — until the view is smooth enough to look at, rather than stuttering at full detail. It SHALL leave a machine that is keeping up drawing exactly what it draws today, SHALL ignore the first moments of drawing, during which the scan is still being prepared, and SHALL NOT raise the detail again within a session.

#### Scenario: A machine that keeps up
- **WHEN** the view holds a smooth frame rate at full detail
- **THEN** every splat is drawn, as it is today, and nothing about the view changes

#### Scenario: A machine that cannot
- **WHEN** the view stays too slow to look at for a few seconds
- **THEN** less of the scan is drawn until it is smooth again, with no question asked of the person and nothing said on screen

#### Scenario: A moment of slowness
- **WHEN** the view is slow only while the scan is first being prepared, or for a moment
- **THEN** the detail is left alone

## MODIFIED Requirements

### Requirement: First-person movement
The viewer SHALL move with W/A/S/D on the horizontal plane and Q/E vertically, with Shift for faster movement, and SHALL turn in place on drag without changing the camera's position. On a screen that is touched, the viewer SHALL also offer a movement control under a thumb, so that a person with no keyboard can move through the scan as well as look around it; that control SHALL move the camera the same way and at the same speed the keys do.

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
- **WHEN** a press begins on the movement control and finishes over a person or a marker in the view
- **THEN** nothing is opened or watched: the press moved them and did nothing else
