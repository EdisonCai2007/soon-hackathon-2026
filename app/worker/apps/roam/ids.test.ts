import { expect, it } from "vitest";
import { hashed, hostKey, isNoteId, isRoomId, keeperKey, memberId, noteId, noteSecret, roomId, sameKey } from "./ids.ts";

it("makes a long random room id, a shorter member id, and a longer host key", () => {
  const id = roomId();
  expect(id).toMatch(/^[0-9a-f]{20}$/);
  expect(memberId()).toMatch(/^[0-9a-f]{12}$/);
  expect(hostKey()).toMatch(/^[0-9a-f]{48}$/);
  // Two rooms in a row never share a name.
  expect(roomId()).not.toBe(id);
});

it("knows a room id from anything else in the address", () => {
  expect(isRoomId(roomId())).toBe(true);
  expect(isRoomId(null)).toBe(false);
  expect(isRoomId("")).toBe(false);
  expect(isRoomId("../secrets")).toBe(false);
  expect(isRoomId("ABCDEF0123456789abcd")).toBe(false);
  expect(isRoomId("0123456789abcdef012")).toBe(false);
});

it("makes a note's name and the two secrets that remove one", () => {
  const id = noteId();
  expect(id).toMatch(/^[0-9a-f]{16}$/);
  expect(noteSecret()).toMatch(/^[0-9a-f]{48}$/);
  expect(keeperKey()).toMatch(/^[0-9a-f]{48}$/);
  expect(noteId()).not.toBe(id);
});

it("knows a note's name from anything else in the address", () => {
  expect(isNoteId(noteId())).toBe(true);
  expect(isNoteId(null)).toBe(false);
  expect(isNoteId("0123456789abcde")).toBe(false);
  expect(isNoteId("0123456789ABCDEF")).toBe(false);
});

it("keeps a secret only as its hash, the same one every time", async () => {
  const secret = noteSecret();
  const hash = await hashed(secret);
  expect(hash).toMatch(/^[0-9a-f]{64}$/);
  expect(await hashed(secret)).toBe(hash);
  expect(await hashed(`${secret}x`)).not.toBe(hash);
  // The seeded notes' own secret, so staging's rows and this code agree on one answer.
  expect(await hashed("seeded-secret")).toBe("3e21b8fc16040e31865f18121e109ff1ca6509fceb17b7d5e1842f73d3e50d0a");
});

it("accepts only the host's own key", () => {
  const key = hostKey();
  expect(sameKey(key, key)).toBe(true);
  // A key differing in one place only, built so it can never land on the real one by chance.
  expect(sameKey(`${key.slice(0, -1)}${key.endsWith("0") ? "1" : "0"}`, key)).toBe(false);
  expect(sameKey(`0${key.slice(1)}`, `1${key.slice(1)}`)).toBe(false);
  expect(sameKey("short", key)).toBe(false);
  expect(sameKey("", "")).toBe(true);
});
