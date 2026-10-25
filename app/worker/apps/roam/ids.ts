// A room's name and its host's key: random, never guessed, and never derived from who is calling.
const toHex = (bytes: Uint8Array): string => [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
const hex = (bytes: number): string => toHex(crypto.getRandomValues(new Uint8Array(bytes)));

/** The id in a shareable link: long enough that holding the link is the only way into a room. */
export const roomId = (): string => hex(10);
export const memberId = (): string => hex(6);
export const hostKey = (): string => hex(24);

/** A note's name in its place, the secret its author keeps, and the key the place's one keeper holds. */
export const noteId = (): string => hex(8);
export const noteSecret = (): string => hex(24);
export const keeperKey = (): string => hex(24);

const ROOM_ID = /^[0-9a-f]{20}$/;
export const isRoomId = (value: string | null): value is string => value !== null && ROOM_ID.test(value);

const NOTE_ID = /^[0-9a-f]{16}$/;
export const isNoteId = (value: string | null): value is string => value !== null && NOTE_ID.test(value);

/** What a place keeps instead of a secret, so a leaked row removes nobody's note. */
export async function hashed(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return toHex(new Uint8Array(digest));
}

/** Compares in one pass over the whole key, so a wrong guess learns nothing from how long it took. */
export function sameKey(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let difference = 0;
  for (let at = 0; at < expected.length; at++) difference |= given.charCodeAt(at) ^ expected.charCodeAt(at);
  return difference === 0;
}
