## ADDED Requirements

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

### Requirement: What a walking guest's phone draws
While a guest walks the scan with their own body, the scanned home SHALL be the whole of the view rather than something turned on and off, since there is nothing of the real room worth comparing it with, and ROAM SHALL draw no more of it than the phone can carry, by drawing a set number of splats rather than every splat the scan holds. Where the frame rate cannot be held or the 3D view is lost, ROAM SHALL end the walk, say so plainly, and return the person to the room view they came from.

#### Scenario: A scan bigger than the phone
- **WHEN** the scan holds far more splats than the phone can draw at once
- **THEN** the phone draws a chosen number of them, nearest and largest first, rather than attempting all of them

#### Scenario: Too slow for this phone
- **WHEN** a guest's phone cannot hold a usable frame rate while walking
- **THEN** the walk ends, the page says the phone could not carry it, and they are back in the room view with its own controls, still in the room with everybody else

#### Scenario: The 3D view is lost
- **WHEN** the phone loses the 3D view while a guest is walking
- **THEN** the walk ends and is said to have ended, and they are back in the room view, still in the room
