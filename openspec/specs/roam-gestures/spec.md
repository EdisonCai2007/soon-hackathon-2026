# roam-gestures Specification

## Purpose
Hands read from a person's own camera inside a live ROAM room: a held sign fires one of a named list of techniques, drawn in the scan where its caster stands and heard from there by everyone in the room, with the reading off until it is asked for, a hold before a sign counts, a wait between casts, and no effect on anything in the room but the look of it.

## Requirements
### Requirement: Hands are read only when asked for
ROAM SHALL read a person's hands from their own camera only after that person turns hand reading on, SHALL stop reading when they turn it off or leave the room, and SHALL say plainly when hands cannot be read at all in their browser.

#### Scenario: A room nobody asked
- **WHEN** a person opens a room's link and does not turn hand reading on
- **THEN** no hand reading runs, nothing about hands is downloaded, and the room behaves exactly as it does without this capability

#### Scenario: Hands cannot be read here
- **WHEN** a person turns hand reading on and their browser cannot run it
- **THEN** they are told so, hand reading returns to off, and the rest of the room keeps working

### Requirement: A held sign fires a named technique
ROAM SHALL recognise a fixed list of hand signs, SHALL fire a sign's technique only once the sign has been held steadily, and SHALL refuse to fire again until that technique has finished and its wait has passed. It SHALL show the person which sign it can currently see.

#### Scenario: Make the sign
- **WHEN** a person holds a recognised sign in front of their camera
- **THEN** that sign's technique fires once, and the person can see which sign was recognised

#### Scenario: A wave is not a sign
- **WHEN** a person moves their hands through a sign's shape without holding it, or holds it again before the wait has passed
- **THEN** nothing fires

### Requirement: A technique is seen and heard where its caster stands
ROAM SHALL draw a fired technique in the scan at the position the room reports for the person who cast it, SHALL show it to everyone in that room, and SHALL play its sound from that same position, growing and fading with distance as a person's voice does. The sound SHALL be made by the page rather than played from a recording.

#### Scenario: Someone else casts across the room
- **WHEN** another person in the room fires a technique
- **THEN** it is drawn around where that person is standing in the scan and heard from that direction and distance

#### Scenario: It ends
- **WHEN** a technique reaches the end of its life, or its caster leaves the room while it runs
- **THEN** it stops being drawn and heard, and the scan, the figures and anything left in the room are unchanged by it

### Requirement: A technique changes nothing in the room
A technique SHALL be appearance alone: it SHALL NOT move, remove, hide or alter any person, figure or part of the scan, and SHALL NOT prevent anybody from moving, pressing or hearing anything while it runs.

#### Scenario: Cast while someone is being watched
- **WHEN** a technique runs while a person is walking the scan or watching somebody
- **THEN** all of that keeps working, and nothing in the room is different once the technique has finished
