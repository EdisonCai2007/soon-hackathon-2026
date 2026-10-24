// A room's name and its host's key: random, never guessed, and never derived from who is calling.
const hex = (bytes: number): string =>
  [...crypto.getRandomValues(new Uint8Array(bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");

/** The id in a shareable link: long enough that holding the link is the only way into a room. */
export const roomId = (): string => hex(10);
export const memberId = (): string => hex(6);
export const hostKey = (): string => hex(24);

const ROOM_ID = /^[0-9a-f]{20}$/;
export const isRoomId = (value: string | null): value is string => value !== null && ROOM_ID.test(value);

/** Compares in one pass over the whole key, so a wrong guess learns nothing from how long it took. */
export function sameKey(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let at = 0; at < expected.length; at++) difference |= given.charCodeAt(at) ^ expected.charCodeAt(at);
  return difference === 0;
}
