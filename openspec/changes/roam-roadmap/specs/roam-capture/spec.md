## ADDED Requirements

### Requirement: A phone joins and reports its own position
The phone page SHALL capture the camera and the phone's own 6DoF position on the device and stream both into the room. ROAM SHALL NOT estimate the camera's position from the video image.

#### Scenario: Go live from a phone
- **WHEN** a person opens the phone link on a supported Android phone and starts
- **THEN** their video and live position stream into the room, and their figure appears to viewers at their place in the scan

### Requirement: A marker lines the phone up with the scan
The phone page SHALL align the phone's tracking to the scan's coordinates by sighting a known marker once, and SHALL block going live until then.

#### Scenario: Anchor on the marker
- **WHEN** the person points the phone at the ROAM marker during setup
- **THEN** their position locks to the scan, and the phone's own tracking keeps them placed afterward

#### Scenario: Not yet anchored
- **WHEN** a person tries to go live before anchoring
- **THEN** the page asks them to sight the marker first instead of placing them at a wrong spot
