# roam-presence Specification

## ADDED Requirements

### Requirement: A link joins everyone to the same room
ROAM SHALL let a person start a room and share it as a link, and SHALL place everyone who opens that link in the same scanned room, each with their own point of view. It SHALL relay each person's position to the others and SHALL reflect joins and leaves within a short delay, needing no sign-in.

#### Scenario: Join and see who is there
- **WHEN** a person opens a room's link and goes live
- **THEN** they see every other person in the room at the place that person reports, and the others see them

#### Scenario: Someone leaves
- **WHEN** a person closes the page or loses their connection
- **THEN** the others stop seeing and hearing them, with no figure or voice left behind

### Requirement: A room holds only as many people as it can carry
A room SHALL refuse a joiner once it is full and SHALL say so, rather than admitting them to a room that cannot carry them.

#### Scenario: One too many
- **WHEN** a person opens the link of a room that is already full
- **THEN** they are told the room is full and nobody already in it is affected

### Requirement: The host can remove someone
The person who started a room SHALL be able to remove anyone in it, and nobody else SHALL be able to. A removed person SHALL be disconnected and SHALL be told why.

#### Scenario: Remove an unwanted guest
- **WHEN** the host removes a person from the list of who is in
- **THEN** that person's figure and voice go for everyone, and they are told they were removed

#### Scenario: A guest tries to remove someone
- **WHEN** a person who is not the host asks to remove anyone
- **THEN** nothing changes and the room keeps running

### Requirement: The room survives a bad message
A room SHALL ignore a message it cannot trust — unknown, misshapen, oversized, or placing a person outside the scanned space — without disconnecting anyone else.

#### Scenario: A nonsense message arrives
- **WHEN** a connected page sends a message that does not fit the room's shape
- **THEN** the message is ignored and every other person in the room is unaffected
