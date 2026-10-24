import { expect, it } from "vitest";
import { hostKey, isRoomId, memberId, roomId, sameKey } from "./ids.ts";

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

it("accepts only the host's own key", () => {
  const key = hostKey();
  expect(sameKey(key, key)).toBe(true);
  // A key differing in one place only, built so it can never land on the real one by chance.
  expect(sameKey(`${key.slice(0, -1)}${key.endsWith("0") ? "1" : "0"}`, key)).toBe(false);
  expect(sameKey(`0${key.slice(1)}`, `1${key.slice(1)}`)).toBe(false);
  expect(sameKey("short", key)).toBe(false);
  expect(sameKey("", "")).toBe(true);
});
