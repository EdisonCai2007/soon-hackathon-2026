## MODIFIED Requirements

### Requirement: A guest in a room can walk the scan by walking
Where a person has joined a room from somewhere other than the home itself and their phone can track its own movement, ROAM SHALL prominently offer to let them walk the scan with their own body once the view is ready, through an explicit start action. While that is running, their own real movement and facing SHALL move their view through the scan at life size, one real metre to one metre of scan, and their place SHALL be relayed to the room as it is when any other control moves them. The view SHALL start from where their view already stood when they asked, preserving its position, eye height and heading rather than using a fixed place in the home. The displayed viewpoint and shared pose SHALL agree, and inactive controls SHALL NOT overwrite them.

#### Scenario: Walking at home walks the home
- **WHEN** a guest with a tracking phone asks to walk and then takes a step and turns
- **THEN** their view moves a step and turns in the scan, starting from the place they were already looking from, and the others in the room see their figure move with them

#### Scenario: Not a tracking phone
- **WHEN** a guest's browser cannot tell where the phone is, as on an iPhone
- **THEN** an explanation says physical walking is unavailable, no start action is offered, and they move with the view's own controls instead, with nothing broken or hidden

#### Scenario: The real floor runs out
- **WHEN** a guest reaches the edge of the floor they really have and asks to carry on
- **THEN** they keep the position, eye height and facing they reached in the scan in both their view and their shared pose, and where they are now standing becomes the new starting point, so subsequent movement continues without a jump

#### Scenario: Leaving the walk
- **WHEN** the guest stops walking, or the session ends on its own
- **THEN** the page returns to the ordinary room view at the last valid position, eye height and heading, without reversing their facing or sending an old position, with its own controls working

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

## ADDED Requirements

### Requirement: A walking guest knows whether position tracking is active
ROAM SHALL distinguish waiting for tracking, active tracking, and lost tracking. It SHALL NOT publish stale or invented movement as a fresh tracked position. A refused start or an unrecoverable tracking interruption SHALL leave the guest in the room with working ordinary controls at the last valid viewpoint and an explanation.

#### Scenario: Waiting or briefly losing position
- **WHEN** a walk has no valid positional tracking yet or temporarily loses it
- **THEN** its status is visible, no untracked movement changes the shared position, and stopping remains available

#### Scenario: The walk cannot continue
- **WHEN** starting is refused or tracking cannot resume in a consistent reference frame
- **THEN** the guest returns to ordinary controls at the saved or last valid viewpoint, is told why the walk did not continue, and can explicitly try again
