# roam-ar-view Specification

## Purpose
The scan drawn through a phone's AR session: over the real home for whoever is standing in it, placed against a marked spot on the walk screen; and as the whole view for whoever joined the room from elsewhere, so their own walking carries them through the home. Drawn within what the phone can carry, and stepping aside — back to the walk screen, or back to the room's own view — wherever it cannot be carried at all.

## Requirements
### Requirement: The scan is drawn over the real room from the walk screen
Once a phone has lined up on a marked spot on the walk screen, ROAM SHALL draw the scanned home over the real one through the phone's AR session, placed so the marked spot's position, facing and scale in the scan meet the place the person is standing.

#### Scenario: The home appears over itself
- **WHEN** a person standing on a marked spot in the real home picks it on the phone
- **THEN** the scanned home is drawn over the real one, with the scan's own copy of where they stand sitting where they stand

### Requirement: The view moves with the phone
While the session runs, ROAM SHALL take the drawn view from the phone's own tracked pose each frame, so walking and turning in the real home move through the scan, and SHALL NOT move the view from the page.

#### Scenario: Walking moves the view
- **WHEN** the person walks and turns while the scan is drawn
- **THEN** the drawn scan holds its place against the real room as they move

#### Scenario: Tracking is lost
- **WHEN** the phone reports no pose for a frame
- **THEN** the page says tracking is lost and the drawing waits for it rather than jumping somewhere wrong

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

### Requirement: A guest in a room can walk the scan by walking
Where a person has joined a room from somewhere other than the home itself and their phone can track its own movement, ROAM SHALL offer to let them walk the scan with their own body. While that is running, their own real movement and facing SHALL move their view through the scan at life size, one real metre to one metre of scan, and their place SHALL be relayed to the room as it is when any other control moves them. The view SHALL start from where their view already stood when they asked, not from a fixed place in the home.

#### Scenario: Walking at home walks the home
- **WHEN** a guest with a tracking phone asks to walk and then takes a step and turns
- **THEN** their view moves a step and turns in the scan, starting from the place they were already looking from, and the others in the room see their figure move with them

#### Scenario: Not a tracking phone
- **WHEN** a guest's browser cannot tell where the phone is, as on an iPhone
- **THEN** walking is not offered, and they move with the view's own controls instead, with nothing broken or hidden

#### Scenario: The real floor runs out
- **WHEN** a guest reaches the edge of the floor they really have and asks to carry on
- **THEN** they keep the place they reached in the scan, and where they are now standing becomes the new starting point, so walking on from there continues through the home

#### Scenario: Leaving the walk
- **WHEN** the guest stops walking, or the session ends on its own
- **THEN** the page returns to the ordinary room view, looking from where they had walked to, with its own controls working

### Requirement: A guest's drawing failing returns them to the page
While a guest is walking the scan with their own body, the scanned home SHALL be the whole of the view rather than something turned on and off, since there is nothing of the real room worth comparing it with. Where the frame rate cannot be held or the 3D view is lost, ROAM SHALL end the walk, say so plainly, and return the person to the room view they came from.

#### Scenario: Too slow for this phone
- **WHEN** a guest's phone cannot hold a usable frame rate while walking
- **THEN** the walk ends, the page says the phone could not carry it, and they are back in the room view with its own controls, still in the room with everybody else
