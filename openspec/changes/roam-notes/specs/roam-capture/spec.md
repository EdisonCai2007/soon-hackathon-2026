## MODIFIED Requirements

### Requirement: Lining up once ties the phone to the scan
The phone page SHALL line the phone's tracking up with the scan from a known spot in the real home, confirmed by the person, and SHALL refuse to place them until that is done. Several marked spots SHALL be offered, each a place the scan already knows, so the person picks the one they are standing on; a spot SHALL settle which floor they are on as well as where. The person SHALL be able to line up again at any of those spots while they walk, so tracking that has drifted is corrected without starting over.

#### Scenario: Stand on a spot
- **WHEN** the person stands on one of the marked spots facing the marked direction and picks it
- **THEN** their position locks to the matching place and floor in the scan, and the phone's own tracking keeps them placed as they walk

#### Scenario: Lining up again after a walk
- **WHEN** the person has walked far enough that their place in the scan has drifted, and they stand on another marked spot and pick it
- **THEN** their position locks to that spot, and what they do next is placed from there instead of from the spot they started at

#### Scenario: Not lined up yet
- **WHEN** the person tries to be placed in the scan before picking a spot
- **THEN** the page asks them to line up first instead of placing them somewhere wrong

## ADDED Requirements

### Requirement: A phone can line up with no room running
The phone SHALL be able to line up with the scan and report where it is standing when no live room exists, so that someone alone in the real home can work with the place without anybody else being present.

#### Scenario: Alone in the home
- **WHEN** a person opens the phone's page for the place while nobody else is in the app
- **THEN** they can line up and be placed in the scan, with no room to join and nobody to wait for
