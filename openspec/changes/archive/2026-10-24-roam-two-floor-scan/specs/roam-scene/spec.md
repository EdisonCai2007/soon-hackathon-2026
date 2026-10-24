## ADDED Requirements

### Requirement: The scan covers both floors
The scan SHALL include the upstairs rooms and the floor below, joined by the staircase, with the source-video cameras of every floor offered as camera presets, and SHALL show no people captured in the source videos. A figure in a shared room SHALL stand on the floor under it.

#### Scenario: Go downstairs
- **WHEN** the person picks a stairs, hallway or lobby camera from the camera choice
- **THEN** the camera moves to that spot on the lower floor, and walking from there reaches the stairs back up

#### Scenario: Look for people
- **WHEN** the person walks the lobby, where people were present while it was filmed
- **THEN** no person appears in the scan

#### Scenario: A guest downstairs
- **WHEN** a guest in a shared room stands on the lower floor
- **THEN** their figure stands on the lower floor at the same size as a figure upstairs
