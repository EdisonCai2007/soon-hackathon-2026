-- The ROAM app's lasting places (app/worker/apps/roam/): what people leave standing in the real home, kept at the spot
-- and facing it was left at, and the one keeper of each place. Times are milliseconds since 1970. Additive only.
CREATE TABLE roam_notes (
  place TEXT NOT NULL,
  id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('text', 'voice', 'photo')),
  -- Where the phone stood, in the scan's own units, and the way it faced. The floor follows from y.
  x REAL NOT NULL,
  y REAL NOT NULL,
  z REAL NOT NULL,
  yaw REAL NOT NULL,
  author TEXT NOT NULL,
  -- A written note's words; empty for a clip or a photograph.
  words TEXT NOT NULL,
  -- A clip's or a photograph's bytes beside the row: this account has no object storage, and the caps keep each small.
  media BLOB,
  media_type TEXT,
  -- The SHA-256 of the secret handed to the author's browser, so a leaked row removes nothing.
  secret_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (place, id)
);
CREATE INDEX roam_notes_place ON roam_notes(place, created_at);
CREATE TABLE roam_places (
  place TEXT NOT NULL PRIMARY KEY,
  -- The SHA-256 of the keeper's key, written once: a place already claimed can not be taken over.
  keeper_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
