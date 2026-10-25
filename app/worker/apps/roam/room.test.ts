import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RoamRoom, type RoomState } from "./room.ts";
import { CAPACITY, type Member, type Outgoing } from "./wire.ts";

// The runtime's own socket, stood in: it keeps what was sent, how it was closed, and its attachment.
class FakeSocket {
  readonly sent: string[] = [];
  closed: { code: number; reason: string } | null = null;
  private attachment: unknown = null;
  send(text: string) { this.sent.push(text); }
  close(code: number, reason: string) { this.closed = { code, reason }; }
  serializeAttachment(value: unknown) { this.attachment = value; }
  deserializeAttachment(): unknown { return this.attachment; }
  got(): Outgoing[] { return this.sent.map(text => JSON.parse(text) as Outgoing); }
}

type State = RoomState & { sockets: FakeSocket[] };

const roomState = (): State => {
  const store = new Map<string, unknown>();
  const sockets: FakeSocket[] = [];
  return {
    sockets,
    storage: {
      get: <T>(key: string) => Promise.resolve(store.get(key) as T | undefined),
      put: <T>(key: string, value: T) => { store.set(key, value); return Promise.resolve(); },
    },
    acceptWebSocket: (ws: WebSocket) => { sockets.push(ws as unknown as FakeSocket); },
    getWebSockets: () => sockets as unknown as WebSocket[],
  };
};

const socket = (query = "") => new Request(`https://room/socket${query}`, { headers: { Upgrade: "websocket" } });

async function join(room: RoamRoom, state: State, query = "") {
  const response = await room.fetch(socket(query));
  const joined = state.sockets[state.sockets.length - 1];
  const welcome = joined.got().find(message => message.type === "welcome");
  return { response, socket: joined, self: welcome?.type === "welcome" ? welcome.self : null };
}

const asWebSocket = (fake: FakeSocket) => fake as unknown as WebSocket;
const sendTo = (room: RoamRoom, fake: FakeSocket, body: unknown) => room.webSocketMessage(asWebSocket(fake), JSON.stringify(body));

beforeEach(() => {
  // Workers answers an upgrade with 101 and a socket pair; Node's own Response refuses that status, and
  // its WebSocketPair does not exist, so both are stood in for the shell's two lines that use them.
  vi.stubGlobal("WebSocketPair", class { constructor() { return [new FakeSocket(), new FakeSocket()]; } });
  const real = globalThis.Response;
  class Upgradable extends real {
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      super(body, init?.status === 101 ? { ...init, status: 200 } : init);
      if (init?.status === 101) Object.defineProperty(this, "status", { value: 101 });
    }
  }
  vi.stubGlobal("Response", Upgradable);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("hands out the host's key once, so a guessed room id can not take over a room", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const made = await room.fetch(new Request("https://room/create", { method: "POST" }));
  expect(made.status).toBe(200);
  expect(await made.json<{ hostKey: string }>()).toEqual({ hostKey: expect.stringMatching(/^[0-9a-f]{48}$/) });
  const again = await room.fetch(new Request("https://room/create", { method: "POST" }));
  expect([again.status, await again.json()]).toEqual([409, { error: "Room exists" }]);
});

it("refuses anything but an upgrade on the socket's address", async () => {
  const response = await new RoamRoom(roomState()).fetch(new Request("https://room/socket"));
  expect([response.status, await response.text()]).toEqual([426, "Expected a websocket"]);
});

it("welcomes a joiner, tells those already in, and names and colours each one", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const first = await join(room, state, "?name=%20%20Sam%20Taylor%20");
  expect(first.response.status).toBe(101);
  expect(first.socket.got()).toEqual([{ type: "welcome", self: expect.objectContaining({ name: "Sam Taylor", role: "guest", pose: null }), members: [], capacity: CAPACITY }]);

  const second = await join(room, state, "?name=Jo&role=camera");
  expect(second.self).toMatchObject({ name: "Jo", role: "camera" });
  expect(second.self!.color).not.toBe(first.self!.color);
  const welcome = second.socket.got()[0];
  expect(welcome.type === "welcome" && welcome.members).toEqual([first.self]);
  expect(first.socket.got()[1]).toEqual({ type: "joined", member: second.self });
});

it("sends a position to everyone else and remembers it for whoever joins next", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const first = await join(room, state);
  const second = await join(room, state);
  const pose = { x: 1, y: -1, z: 0.5, yaw: 2 };
  await sendTo(room, second.socket, { type: "pose", pose });
  expect(first.socket.got().at(-1)).toEqual({ type: "pose", id: second.self!.id, pose });
  // The sender is not told its own position back.
  expect(second.socket.got().some(message => message.type === "pose")).toBe(false);
  const third = await join(room, state);
  const welcome = third.socket.got()[0];
  expect(welcome.type === "welcome" && welcome.members).toContainEqual({ ...second.self, pose });
});

it("passes a cast to everyone else, and refuses one sent sooner than the wait", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const first = await join(room, state);
  const second = await join(room, state);
  vi.setSystemTime(new Date(10_000));
  await sendTo(room, second.socket, { type: "cast", technique: "domain" });
  expect(first.socket.got().at(-1)).toEqual({ type: "cast", id: second.self!.id, technique: "domain" });
  expect(second.socket.got().some(message => message.type === "cast")).toBe(false);

  const quiet = first.socket.sent.length;
  vi.setSystemTime(new Date(11_000));
  await sendTo(room, second.socket, { type: "cast", technique: "blue" });
  expect(first.socket.sent.length).toBe(quiet);
  expect(second.socket.closed).toBeNull();

  vi.setSystemTime(new Date(20_000));
  await sendTo(room, second.socket, { type: "cast", technique: "blue" });
  expect(first.socket.got().at(-1)).toEqual({ type: "cast", id: second.self!.id, technique: "blue" });
});

it("passes a handshake only to the person it names, and drops one for nobody", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const first = await join(room, state);
  const second = await join(room, state);
  const third = await join(room, state);
  await sendTo(room, first.socket, { type: "signal", to: second.self!.id, data: { sdp: "v=0" } });
  expect(second.socket.got().at(-1)).toEqual({ type: "signal", from: first.self!.id, data: { sdp: "v=0" } });
  expect(third.socket.got().some(message => message.type === "signal")).toBe(false);
  const quiet = third.socket.sent.length;
  await sendTo(room, first.socket, { type: "signal", to: "nobody", data: 1 });
  expect(third.socket.sent.length).toBe(quiet);
});

it("ignores a message with no member behind it, and one it can not read", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const first = await join(room, state);
  const stranger = new FakeSocket();
  await room.webSocketMessage(asWebSocket(stranger), JSON.stringify({ type: "pose", pose: { x: 0, y: 0, z: 0, yaw: 0 } }));
  await room.webSocketMessage(asWebSocket(first.socket), "not json");
  expect(first.socket.got().filter(message => message.type === "pose")).toEqual([]);
});

it("lets the host remove someone, and nobody else", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const made = await room.fetch(new Request("https://room/create", { method: "POST" }));
  const { hostKey } = await made.json<{ hostKey: string }>();
  const host = await join(room, state, "?name=Jo");
  const guest = await join(room, state, "?name=Sam");

  await sendTo(room, host.socket, { type: "remove", id: guest.self!.id, key: "wrong" });
  expect(guest.socket.closed).toBeNull();
  await sendTo(room, host.socket, { type: "remove", id: "nobody", key: hostKey });
  expect(guest.socket.closed).toBeNull();

  await sendTo(room, host.socket, { type: "remove", id: guest.self!.id, key: hostKey });
  expect(guest.socket.got().at(-1)).toEqual({ type: "closed", reason: "removed" });
  expect(guest.socket.closed).toEqual({ code: 4003, reason: "removed" });
  expect(host.socket.got().at(-1)).toEqual({ type: "left", id: guest.self!.id });
});

it("removes nobody in a room that was never started, so no key can match", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const host = await join(room, state);
  const guest = await join(room, state);
  await sendTo(room, host.socket, { type: "remove", id: guest.self!.id, key: "anything" });
  expect(guest.socket.closed).toBeNull();
});

it("tells a joiner the room is full instead of letting it stutter", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const joined = [];
  for (let at = 0; at < CAPACITY; at++) joined.push(await join(room, state));
  const extra = await join(room, state);
  expect(extra.response.status).toBe(101);
  expect(extra.socket.got()).toEqual([{ type: "closed", reason: "full" }]);
  expect(extra.socket.closed).toEqual({ code: 4002, reason: "full" });
  // Nobody already in the room hears about it.
  expect(joined[0].socket.got().filter(message => message.type === "joined")).toHaveLength(CAPACITY - 1);
});

it("lists who is in the room for the host's own screen", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const first = await join(room, state, "?name=Jo");
  const response = await room.fetch(new Request("https://room/members"));
  expect(await response.json<{ members: Member[] }>()).toEqual({ members: [first.self] });
});

it("drops a member who closes or breaks, and tells the others once each", async () => {
  const state = roomState();
  const room = new RoamRoom(state);
  const first = await join(room, state);
  const second = await join(room, state);
  const third = await join(room, state);

  room.webSocketClose(asWebSocket(second.socket));
  expect(first.socket.got().at(-1)).toEqual({ type: "left", id: second.self!.id });

  room.webSocketError(asWebSocket(third.socket));
  expect(first.socket.got().at(-1)).toEqual({ type: "left", id: third.self!.id });

  // A socket with nothing attached was never a member, so nobody is told anything.
  const before = first.socket.sent.length;
  room.webSocketClose(asWebSocket(new FakeSocket()));
  expect(first.socket.sent.length).toBe(before);
});
