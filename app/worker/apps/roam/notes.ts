// What a place will keep, as plain functions: note-routes.ts holds the database and calls these, so every rule is
// tested without a runtime. The address is open to anyone holding it, so every cap is judged here.
import { readName, readPose, type Pose } from "./wire.ts";

/** The places that exist. One scan, one place; a second scan adds a name here and nothing else. */
const PLACES = ["home"] as const;
export type Place = (typeof PLACES)[number];

type Kind = "text" | "voice" | "photo";

// A phone records Opus at about 15 KB a second, so fifteen seconds is around 230 KB: the cap leaves room for a
// louder recorder without coming near what a database value holds.
export const CAPS = { words: 500, media: 400_000, notes: 200 };
// The whole request, so a padded upload is refused before its bytes are read.
export const MAX_UPLOAD = 600_000;

const MEDIA: Record<Kind, readonly string[]> = {
  text: [],
  voice: ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"],
  photo: ["image/jpeg", "image/png"],
};

export const ERRORS = {
  bad_place: "No such place.", bad_body: "A note is sent as a form.", bad_kind: "A note is written, spoken or photographed.",
  bad_position: "A note needs the spot it was left at.", bad_words: "A written note needs its words, within the cap.",
  bad_media: "A spoken or photographed note needs its own kind of file.",
  too_large: "That file is larger than a note may carry.", full: "This place holds as many notes as it can.",
  not_found: "No such note.", refused: "Only whoever left a note, or whoever keeps the place, can remove it.",
  claimed: "This place already has a keeper.",
};
export type Fault = keyof typeof ERRORS;

export const isPlace = (value: string | null): value is Place => PLACES.includes(value as Place);
const isKind = (value: unknown): value is Kind => value === "text" || value === "voice" || value === "photo";

/** The type without the parameters a recorder adds, so `audio/webm;codecs=opus` is judged as `audio/webm`. */
export const mediaType = (raw: string): string => raw.split(";")[0].trim().toLowerCase();

/** A note as it is about to be kept, or the one fault that stops it. */
export type Leaving = { kind: Kind; spot: Pose; author: string; words: string; media: Uint8Array | null; mediaType: string | null };
export type Given = { kind: unknown; spot: unknown; author: unknown; media: { bytes: Uint8Array; type: string } | null; words: unknown };

export function readLeaving(given: Given): Leaving | Fault {
  if (!isKind(given.kind)) return "bad_kind";
  const spot = readPose(given.spot);
  if (!spot) return "bad_position";
  const written = given.kind === "text";
  const words = typeof given.words === "string" ? given.words.trim() : "";
  if (written && (words === "" || words.length > CAPS.words)) return "bad_words";
  if (written !== (given.media === null)) return "bad_media";
  if (given.media && !MEDIA[given.kind].includes(mediaType(given.media.type))) return "bad_media";
  if (given.media && given.media.bytes.byteLength > CAPS.media) return "too_large";
  return { kind: given.kind, spot, author: readName(typeof given.author === "string" ? given.author : null),
    words: written ? words : "", media: given.media?.bytes ?? null, mediaType: given.media ? mediaType(given.media.type) : null };
}

/** A note as a page reads it: where it is, who left it, and whether there is anything to fetch. */
export type Note = { id: string; kind: Kind; spot: Pose; author: string; words: string; media: boolean; createdAt: number };
export type Row = { id: string; kind: Kind; x: number; y: number; z: number; yaw: number; author: string; words: string;
  media: number; created_at: number };

export const listed = (row: Row): Note => ({ id: row.id, kind: row.kind, spot: { x: row.x, y: row.y, z: row.z, yaw: row.yaw },
  author: row.author, words: row.words, media: row.media === 1, createdAt: row.created_at });

export const isFull = (count: number): boolean => count >= CAPS.notes;

/** A kept file's bytes, however the database hands them over: D1 answers with an array of byte values, and the
 *  test suite's own database with the bytes themselves. */
export const mediaBytes = (media: ArrayBuffer | Uint8Array | number[]): Uint8Array =>
  media instanceof Uint8Array ? media : new Uint8Array(media);
