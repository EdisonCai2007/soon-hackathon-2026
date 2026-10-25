## REMOVED Requirements

### Requirement: The scan is drawn over the real room
**Reason**: Its second scenario placed the view the same way a note is, and notes are gone; a dropped scenario needs the requirement removed and added back under a new name.
**Migration**: Replaced by "The scan is drawn over the real room from the walk screen", which keeps the first scenario unchanged.

## ADDED Requirements

### Requirement: The scan is drawn over the real room from the walk screen
Once a phone has lined up on a marked spot on the walk screen, ROAM SHALL draw the scanned home over the real one through the phone's AR session, placed so the marked spot's position, facing and scale in the scan meet the place the person is standing.

#### Scenario: The home appears over itself
- **WHEN** a person standing on a marked spot in the real home picks it on the phone
- **THEN** the scanned home is drawn over the real one, with the scan's own copy of where they stand sitting where they stand

## MODIFIED Requirements

### Requirement: The scan is turned on and off by the person
ROAM SHALL offer one control that turns the drawn scan on and off, SHALL start with it off, and SHALL say which state it is in, so the person chooses when to see the scan and can compare it with the real room by turning it off.

#### Scenario: Turning it on
- **WHEN** the person has lined up and presses the control
- **THEN** the scan is drawn over the real room, and the page says the scan is on

#### Scenario: Turning it off
- **WHEN** the person presses the control again
- **THEN** the scan is not drawn, the view is the camera's picture with the page's controls over it, and tracking and walking go on unaffected

### Requirement: A phone that cannot carry the drawing keeps working
ROAM SHALL draw no more of the scan than a phone can carry, by drawing it at a level of detail within a set number of splats rather than every splat the scan holds. Where the browser has no AR, the drawing cannot be built, the 3D view is lost, or the phone still cannot hold a usable frame rate, ROAM SHALL say so plainly and SHALL leave lining up and walking working as they do without the drawing.

#### Scenario: A scan bigger than the phone
- **WHEN** the scan holds far more splats than the phone can draw at once
- **THEN** the phone draws a chosen number of them, nearest and largest first, rather than attempting all of them

#### Scenario: Too slow to draw
- **WHEN** the frame rate stays below what the view needs while the scan is on
- **THEN** the scan is turned off, the control goes away, the page says the phone could not carry it, and the session keeps tracking

#### Scenario: The 3D view is lost
- **WHEN** the phone loses the 3D view while the scan is on
- **THEN** the scan is turned off and said to have been, and the session and its tracking carry on

#### Scenario: No AR in this browser
- **WHEN** the browser offers no AR session, as on an iPhone
- **THEN** the page says so and offers to walk the home instead, exactly as it does today
