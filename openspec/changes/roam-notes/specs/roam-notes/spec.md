## ADDED Requirements

### Requirement: A place keeps what people leave in it
The scanned home SHALL be a lasting place whose notes outlive every session: a note left once SHALL still be found by anyone who opens the place's address later, with nobody else present and no sign-in. A note SHALL hold either written words, a spoken clip, or a photograph, and SHALL keep the position and facing it was left at.

#### Scenario: Found later by someone else
- **WHEN** a person opens the place's address after every browser that left a note has closed
- **THEN** the scan shows a marker at each note, and opening one gives back the words, the photograph, or the clip that was left there

#### Scenario: A place with nothing in it
- **WHEN** nobody has left anything yet
- **THEN** the scan is walked exactly as it is without this change, and the page says the place holds no notes rather than showing an empty panel

### Requirement: A note is left from inside the real home
A note SHALL be left by a person standing in the real home with a phone that follows its own movement, and SHALL be placed at the spot that phone was standing, on the floor it was on. ROAM SHALL NOT place a note anywhere the phone's position is unknown, and SHALL refuse to take one before the phone is lined up with the scan.

#### Scenario: Left beside the thing it describes
- **WHEN** a lined-up phone leaves a note while standing next to something in the real home
- **THEN** that note appears in the scan beside the same thing, on the floor the person was on

#### Scenario: Not lined up
- **WHEN** a person tries to leave a note before lining the phone up
- **THEN** the page asks them to line up first and takes no note

### Requirement: A voice note is heard from where it was left
A spoken note SHALL play placed at its own position, so it grows louder as the listener walks towards it and fades as they walk away, and SHALL wait for the press that browsers require before any sound starts.

#### Scenario: Walking towards a voice
- **WHEN** a listener starts a spoken note and then walks the scan
- **THEN** what they hear follows the distance and direction between them and the spot it was left at

### Requirement: What anyone may leave is capped
Because the place's address is open to anyone holding it, ROAM SHALL cap a note's words, a clip's length, a photograph's size, and how many notes one place holds, and SHALL refuse anything past a cap with a reason rather than storing it.

#### Scenario: Too much
- **WHEN** something arrives longer, larger, or more numerous than the caps allow
- **THEN** it is refused, the person is told which cap stopped it, and the place is unchanged

### Requirement: A note can be taken back
Whoever left a note SHALL be able to remove it from the browser they left it in, and one keeper of the place SHALL be able to remove any note. Nobody else SHALL be able to remove one. Removing a note cannot be undone.

#### Scenario: The author removes their own
- **WHEN** the person who left a note opens the place in that same browser and removes it
- **THEN** the note is gone for everyone, and no other note is touched

#### Scenario: Somebody else tries
- **WHEN** a visitor who neither left the note nor keeps the place asks for it to be removed
- **THEN** nothing is removed

### Requirement: The place is claimed once
The place's keeper SHALL be settled by the first claim and SHALL NOT be taken over afterwards, so a later visitor cannot become the keeper of a place that already has one.

#### Scenario: A second claim
- **WHEN** anyone claims a place that has already been claimed
- **THEN** the claim is refused and the first keeper stays the keeper
