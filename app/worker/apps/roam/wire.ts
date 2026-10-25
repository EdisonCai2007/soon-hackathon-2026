// The live room's rules as plain functions: room.ts holds the sockets and calls these, so every rule is
// tested without a runtime. What a page may send is checked here before anything is relayed.
type Pose = { x: number; y: number; z: number; yaw: number };
export type Role = "guest" | "camera";
export type Member = { id: string; name: string; color: string; role: Role; pose: Pose | null; castAt?: number };

// The techniques a page may cast. The page's own list, with each one's life and look, is
// app/src/apps/roam/techniques.ts; the room keeps its own copy, since the two sides share no code.
const TECHNIQUES = ["domain", "purple", "blue"] as const;
type TechniqueName = (typeof TECHNIQUES)[number];
// The shortest life and wait on that list, so the room refuses only what a person could not have made.
export const CAST_WAIT = 2800;

/** Each browser sends its video to every other one, so the cost grows with the square of the room. */
export const CAPACITY = 6;
// The scan spans under five units each way. A pose far outside it is a mistake or mischief, never a person.
const POSE_LIMIT = 50;
// A connection handshake is a few kilobytes of text; nothing a page sends is bigger.
const MAX_MESSAGE = 16384;
const NAME_LIMIT = 24;
const COLORS = ["#f97362", "#4fb8ff", "#ffd166", "#8bd450", "#c58cff", "#ff9ad5"];

export type Incoming =
  | { type: "pose"; pose: Pose }
  | { type: "signal"; to: string; data: unknown }
  | { type: "remove"; id: string; key: string }
  | { type: "cast"; technique: TechniqueName };

export type Outgoing =
  | { type: "welcome"; self: Member; members: Member[]; capacity: number }
  | { type: "joined"; member: Member }
  | { type: "left"; id: string }
  | { type: "pose"; id: string; pose: Pose }
  | { type: "signal"; from: string; data: unknown }
  | { type: "cast"; id: string; technique: TechniqueName }
  | { type: "closed"; reason: "full" | "removed" };

export const isFull = (count: number): boolean => count >= CAPACITY;

/** The name as typed, without the whitespace and length a page could hide in it. */
export function readName(raw: string | null): string {
  const name = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, NAME_LIMIT);
  return name === "" ? "Guest" : name;
}

export const readRole = (raw: string | null): Role => (raw === "camera" ? "camera" : "guest");

/** The first colour nobody in the room has, so figures stay told apart until the room is full. */
export function colorFor(taken: readonly string[]): string {
  return COLORS.find(color => !taken.includes(color)) ?? COLORS[taken.length % COLORS.length];
}

const placed = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= POSE_LIMIT;

/** A position as a page sent it, or null when it falls outside the scan. */
function readPose(value: unknown): Pose | null {
  if (typeof value !== "object" || value === null) return null;
  const { x, y, z, yaw } = value as Record<string, unknown>;
  return placed(x) && placed(y) && placed(z) && placed(yaw) ? { x, y, z, yaw } : null;
}

const text = (value: unknown): value is string => typeof value === "string" && value.length > 0;

const isTechnique = (value: unknown): value is TechniqueName => TECHNIQUES.some(name => name === value);

/** Whether a page has waited long enough since its last cast; a page that never cast always has. */
export const castAllowed = (last: number | undefined, now: number): boolean => last === undefined || now - last >= CAST_WAIT;

function readParsed(body: Record<string, unknown>): Incoming | null {
  if (body.type === "pose") {
    const pose = readPose(body.pose);
    return pose && { type: "pose", pose };
  }
  if (body.type === "signal") return text(body.to) ? { type: "signal", to: body.to, data: body.data } : null;
  if (body.type === "remove") return text(body.id) && text(body.key) ? { type: "remove", id: body.id, key: body.key } : null;
  if (body.type === "cast") return isTechnique(body.technique) ? { type: "cast", technique: body.technique } : null;
  return null;
}

/** What a page sent, or null for anything this room will not act on. A null is ignored, never fatal. */
export function readMessage(raw: string | ArrayBuffer): Incoming | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE) return null;
  let body: unknown;
  try { body = JSON.parse(raw); }
  catch { return null; }
  if (typeof body !== "object" || body === null) return null;
  return readParsed(body as Record<string, unknown>);
}

/** Who a message reaches and what they get: a position or a cast goes to everyone else, a handshake only to
 *  the one member it names, and a removal is the shell's to judge against the host's key. */
export function relay(message: Incoming, self: Member, others: readonly Member[]): { to: string[]; payload: Outgoing } | null {
  if (message.type === "pose") return { to: others.map(member => member.id), payload: { type: "pose", id: self.id, pose: message.pose } };
  if (message.type === "cast") return { to: others.map(member => member.id), payload: { type: "cast", id: self.id, technique: message.technique } };
  if (message.type === "signal") {
    return others.some(member => member.id === message.to)
      ? { to: [message.to], payload: { type: "signal", from: self.id, data: message.data } }
      : null;
  }
  return null;
}
