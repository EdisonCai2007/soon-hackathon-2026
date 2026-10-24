# roam-scene Specification

## ADDED Requirements

### Requirement: The room can fill the screen
The ROAM viewer SHALL offer an action that makes the room view fill the whole screen and return to the page, keeping the view's own controls reachable while it is filled.

#### Scenario: Show the room on a projector
- **WHEN** the person chooses to fill the screen
- **THEN** the room view fills the display, its controls stay usable, and leaving full screen restores the page with the camera where it was

### Requirement: The address can carry a room
The ROAM app's address SHALL be able to name a room and a joiner's role, so that one link is everything a person needs to arrive in the right place. The app's plain address SHALL keep walking the scan alone.

#### Scenario: Open the app with no room
- **WHEN** a person opens the app's own address with no room in it
- **THEN** they walk the scanned room by themselves, exactly as they did before rooms existed
