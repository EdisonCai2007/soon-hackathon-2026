import { expect, it } from "vitest";
import { CAPACITY, colorFor, isFull, readMessage, readName, readRole, relay, type Member } from "./wire.ts";

const member = (id: string, color = "#f97362"): Member => ({ id, name: id, color, role: "guest", pose: null });
const pose = { x: 1, y: 2, z: 3, yaw: 0.5 };

it("fills the room at its capacity and not before", () => {
  expect([isFull(0), isFull(CAPACITY - 1), isFull(CAPACITY), isFull(CAPACITY + 1)]).toEqual([false, false, true, true]);
});

it("reads a name without the whitespace or length a page could hide in it", () => {
  expect(readName("  Sam  Taylor ")).toBe("Sam Taylor");
  expect(readName("x".repeat(40))).toBe("x".repeat(24));
  expect([readName(""), readName("   "), readName(null)]).toEqual(["Guest", "Guest", "Guest"]);
});

it("reads the camera role and treats anything else as a guest", () => {
  expect([readRole("camera"), readRole("guest"), readRole("owner"), readRole(null)]).toEqual(["camera", "guest", "guest", "guest"]);
});

it("gives each person a colour nobody has, and reuses them once every one is taken", () => {
  const first = colorFor([]);
  const second = colorFor([first]);
  expect(second).not.toBe(first);
  const all = [first, second, colorFor([first, second])];
  // Six colours for six people: a seventh never joins, but the maths still answers.
  const taken = [...Array(CAPACITY).keys()].reduce<string[]>(seen => [...seen, colorFor(seen)], []);
  expect(new Set(taken).size).toBe(CAPACITY);
  expect(colorFor(taken)).toBe(taken[0]);
  expect(new Set(all).size).toBe(3);
});

it("reads a position, a handshake and a removal", () => {
  expect(readMessage(JSON.stringify({ type: "pose", pose }))).toEqual({ type: "pose", pose });
  expect(readMessage(JSON.stringify({ type: "signal", to: "b2", data: { sdp: "v=0" } }))).toEqual({ type: "signal", to: "b2", data: { sdp: "v=0" } });
  expect(readMessage(JSON.stringify({ type: "remove", id: "b2", key: "k" }))).toEqual({ type: "remove", id: "b2", key: "k" });
});

it("ignores anything it can not act on", () => {
  expect(readMessage(new ArrayBuffer(8))).toBeNull();
  expect(readMessage(`"${"x".repeat(17000)}"`)).toBeNull();
  expect(readMessage("not json")).toBeNull();
  expect(readMessage("null")).toBeNull();
  expect(readMessage("42")).toBeNull();
  expect(readMessage(JSON.stringify({ type: "shout" }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "signal", data: {} }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "signal", to: "", data: {} }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "remove", id: "b2" }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "remove", key: "k" }))).toBeNull();
});

it("refuses a position that is missing, misshapen, or outside the scanned space", () => {
  expect(readMessage(JSON.stringify({ type: "pose" }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "pose", pose: null }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "pose", pose: { x: 0, y: 0, z: 0 } }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "pose", pose: { ...pose, x: "1" } }))).toBeNull();
  expect(readMessage(JSON.stringify({ type: "pose", pose: { ...pose, y: 1e9 } }))).toBeNull();
  expect(readMessage('{"type":"pose","pose":{"x":null,"y":0,"z":0,"yaw":0}}')).toBeNull();
});

it("sends a position to everyone else and a handshake only to the person it names", () => {
  const self = member("a1");
  const others = [member("b2"), member("c3")];
  expect(relay({ type: "pose", pose }, self, others)).toEqual({ to: ["b2", "c3"], payload: { type: "pose", id: "a1", pose } });
  expect(relay({ type: "signal", to: "c3", data: 7 }, self, others)).toEqual({ to: ["c3"], payload: { type: "signal", from: "a1", data: 7 } });
  expect(relay({ type: "signal", to: "gone", data: 7 }, self, others)).toBeNull();
  // A removal is the room's to judge against the host's key, never a relay.
  expect(relay({ type: "remove", id: "b2", key: "k" }, self, others)).toBeNull();
});
