## MODIFIED Requirements

### Requirement: Lining up once ties the phone to the scan
The phone page SHALL line the phone's tracking up with the scan from a known spot in the real home, confirmed by the person, and SHALL refuse to place them until that is done. Several marked spots SHALL be offered, each a place the scan already knows, so the person picks the one they are standing on; a spot SHALL settle which floor they are on as well as where. The person SHALL be able to line up again at any of those spots while they walk, so tracking that has drifted is corrected without starting over. Where the phone draws the scan over the real room, lining up again SHALL move the drawn scan to the newly picked spot as well as the person's place in it.

#### Scenario: Stand on a spot
- **WHEN** the person stands on one of the marked spots facing the marked direction and picks it
- **THEN** their position locks to the matching place and floor in the scan, and the phone's own tracking keeps them placed as they walk

#### Scenario: Lining up again after a walk
- **WHEN** the person has walked far enough that their place in the scan has drifted, and they stand on another marked spot and pick it
- **THEN** their position locks to that spot, the drawn scan is placed against it, and what they do next is placed from there instead of from the spot they started at

#### Scenario: Not lined up yet
- **WHEN** the person tries to be placed in the scan before picking a spot
- **THEN** the page asks them to line up first instead of placing them somewhere wrong
