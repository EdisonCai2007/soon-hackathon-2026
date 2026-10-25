import { expect, it } from "vitest";
import { CAPS, isFull, isPlace, listed, mediaBytes, mediaType, readLeaving, type Given } from "./notes.ts";

const SPOT = { x: 1, y: -3.9, z: 0.5, yaw: 1.2 };
const given = (over: Partial<Given> = {}): Given =>
  ({ kind: "text", spot: SPOT, author: "Sam", words: "The boiler resets behind this panel.", media: null, ...over });
const clip = (type = "audio/webm;codecs=opus", bytes = 2048) => ({ bytes: new Uint8Array(bytes), type });

it("knows the places that exist", () => {
  expect(isPlace("home")).toBe(true);
  expect(isPlace("someone-elses-house")).toBe(false);
  expect(isPlace(null)).toBe(false);
});

it("judges a file by its type without the parameters a recorder adds", () => {
  expect(mediaType("audio/webm;codecs=opus")).toBe("audio/webm");
  expect(mediaType(" IMAGE/JPEG ")).toBe("image/jpeg");
});

it("keeps a written note, trimmed, with the name as typed", () => {
  expect(readLeaving(given({ words: "  Mind the step.  " }))).toEqual({ kind: "text", spot: SPOT, author: "Sam",
    words: "Mind the step.", media: null, mediaType: null });
});

it("keeps a spoken or photographed note with its own bytes and no words", () => {
  expect(readLeaving(given({ kind: "voice", words: "ignored", media: clip() }))).toEqual({ kind: "voice", spot: SPOT,
    author: "Sam", words: "", media: expect.any(Uint8Array), mediaType: "audio/webm" });
  const photo = readLeaving(given({ kind: "photo", words: null, media: clip("image/jpeg") }));
  expect(photo).toMatchObject({ kind: "photo", words: "", mediaType: "image/jpeg" });
});

it("names anybody who left no name, as a room does", () => {
  expect(readLeaving(given({ author: null }))).toMatchObject({ author: "Guest" });
  expect(readLeaving(given({ author: "  Jo  Jones " }))).toMatchObject({ author: "Jo Jones" });
});

it("refuses anything that is not one of the three kinds", () => {
  expect(readLeaving(given({ kind: "video" }))).toBe("bad_kind");
  expect(readLeaving(given({ kind: undefined }))).toBe("bad_kind");
});

it("refuses a note with no spot, or one outside the scan", () => {
  expect(readLeaving(given({ spot: null }))).toBe("bad_position");
  expect(readLeaving(given({ spot: { x: 0, y: 0, z: 0 } }))).toBe("bad_position");
  expect(readLeaving(given({ spot: { ...SPOT, x: 9999 } }))).toBe("bad_position");
});

it("refuses a written note with nothing in it, or more than the cap", () => {
  expect(readLeaving(given({ words: "   " }))).toBe("bad_words");
  expect(readLeaving(given({ words: 7 }))).toBe("bad_words");
  expect(readLeaving(given({ words: "a".repeat(CAPS.words + 1) }))).toBe("bad_words");
  expect(readLeaving(given({ words: "a".repeat(CAPS.words) }))).toMatchObject({ kind: "text" });
});

it("refuses a kind and a file that do not go together", () => {
  expect(readLeaving(given({ media: clip() }))).toBe("bad_media");
  expect(readLeaving(given({ kind: "voice", media: null }))).toBe("bad_media");
  expect(readLeaving(given({ kind: "voice", media: clip("image/jpeg") }))).toBe("bad_media");
  expect(readLeaving(given({ kind: "photo", media: clip("application/zip") }))).toBe("bad_media");
});

it("refuses a file larger than a note may carry", () => {
  expect(readLeaving(given({ kind: "photo", media: clip("image/png", CAPS.media + 1) }))).toBe("too_large");
  expect(readLeaving(given({ kind: "photo", media: clip("image/png", CAPS.media) }))).toMatchObject({ kind: "photo" });
});

it("reads a row as a page wants it, saying whether there is anything to fetch", () => {
  const row = { id: "a".repeat(16), kind: "voice" as const, x: 1, y: 2, z: 3, yaw: 0.5, author: "Sam", words: "",
    media: 1, created_at: 1770000000000 };
  expect(listed(row)).toEqual({ id: row.id, kind: "voice", spot: { x: 1, y: 2, z: 3, yaw: 0.5 }, author: "Sam",
    words: "", media: true, createdAt: row.created_at });
  expect(listed({ ...row, media: 0 }).media).toBe(false);
});

// D1 answers with an array of byte values, not the bytes: a file served straight from the row arrived empty.
it("reads a kept file's bytes however the database hands them over", () => {
  const bytes = new Uint8Array([137, 80, 78, 71]);
  expect(mediaBytes([...bytes])).toEqual(bytes);
  expect(mediaBytes(bytes)).toBe(bytes);
  expect(mediaBytes(bytes.buffer as ArrayBuffer)).toEqual(bytes);
});

it("holds a place to its limit", () => {
  expect(isFull(CAPS.notes - 1)).toBe(false);
  expect(isFull(CAPS.notes)).toBe(true);
});
