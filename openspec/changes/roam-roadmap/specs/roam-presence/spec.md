## ADDED Requirements

### Requirement: A shared room joins everyone to the same scan
ROAM SHALL run a realtime room that participants join from a link. It SHALL relay each figure's position to every viewer and carry the signaling that connects live video, and SHALL reflect joins and leaves to the others within a short delay.

#### Scenario: Join and see who is there
- **WHEN** a viewer opens the room link
- **THEN** they connect and see every figure currently live at its reported place

#### Scenario: A participant leaves
- **WHEN** a participant disconnects
- **THEN** the others see them removed, and no stale figure or marker lingers

### Requirement: Remote guests see each other
The room SHALL show other viewers as soft markers at their positions in the scan.

#### Scenario: Two guests explore together
- **WHEN** two viewers are in the same room
- **THEN** each sees the other as a marker that moves as that person walks
