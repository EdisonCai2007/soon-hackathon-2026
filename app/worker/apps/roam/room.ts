// One live room per link. A plain class, not a subclass of the runtime's base: nothing here imports
// cloudflare:workers, so the test suite opens a room with a stand-in state and stand-in sockets.
import { hostKey, memberId, sameKey } from "./ids.ts";
import { CAPACITY, colorFor, isFull, readMessage, readName, readRole, relay, type Member, type Outgoing } from "./wire.ts";

const HOST = "host";
// Reasons a room closes a socket, outside the range the browser uses for its own.
const FULL = 4002;
const REMOVED = 4003;

type Sockets = { acceptWebSocket(ws: WebSocket, tags?: string[]): void; getWebSockets(tag?: string): WebSocket[] };
type Storage = { get<T>(key: string): Promise<T | undefined>; put<T>(key: string, value: T): Promise<void> };
export type RoomState = { storage: Storage } & Sockets;

const attached = (socket: WebSocket): Member | null => {
  const raw: unknown = socket.deserializeAttachment();
  return raw === null || raw === undefined ? null : raw as Member;
};

const send = (socket: WebSocket, payload: Outgoing) => socket.send(JSON.stringify(payload));

export class RoamRoom implements DurableObject {
  private readonly state: RoomState;

  constructor(state: RoomState) {
    this.state = state;
  }

  private everyone(): { socket: WebSocket; member: Member }[] {
    return this.state.getWebSockets().flatMap(socket => {
      const member = attached(socket);
      return member ? [{ socket, member }] : [];
    });
  }

  private tell(payload: Outgoing, to: readonly string[]) {
    for (const { socket, member } of this.everyone()) if (to.includes(member.id)) send(socket, payload);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/create") return this.create();
    if (url.pathname === "/members") return Response.json({ members: this.everyone().map(({ member }) => member) });
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a websocket", { status: 426 });
    return this.open(url);
  }

  /** The host's key is written once: a guessed room id can not take over a room that already exists. */
  private async create(): Promise<Response> {
    if (await this.state.storage.get<string>(HOST)) return Response.json({ error: "Room exists" }, { status: 409 });
    const key = hostKey();
    await this.state.storage.put(HOST, key);
    return Response.json({ hostKey: key });
  }

  private open(url: URL): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server);
    const present = this.everyone();
    if (isFull(present.length)) {
      send(server, { type: "closed", reason: "full" });
      server.close(FULL, "full");
      return new Response(null, { status: 101, webSocket: client });
    }
    const self: Member = { id: memberId(), name: readName(url.searchParams.get("name")), role: readRole(url.searchParams.get("role")),
      color: colorFor(present.map(({ member }) => member.color)), pose: null };
    server.serializeAttachment(self);
    send(server, { type: "welcome", self, members: present.map(({ member }) => member), capacity: CAPACITY });
    this.tell({ type: "joined", member: self }, present.map(({ member }) => member.id));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const self = attached(socket);
    const message = self && readMessage(raw);
    if (!self || !message) return;
    const others = this.everyone().filter(({ member }) => member.id !== self.id);
    if (message.type === "remove") return this.evict(message, others);
    // A position is kept on the socket so whoever joins next is told where this person already stands.
    if (message.type === "pose") socket.serializeAttachment({ ...self, pose: message.pose });
    const next = relay(message, self, others.map(({ member }) => member));
    if (next) this.tell(next.payload, next.to);
  }

  /** Only the host's own key removes anyone; every other caller changes nothing. */
  private async evict({ id, key }: { id: string; key: string }, others: { socket: WebSocket; member: Member }[]): Promise<void> {
    const expected = await this.state.storage.get<string>(HOST);
    const target = others.find(({ member }) => member.id === id);
    if (!expected || !sameKey(key, expected) || !target) return;
    send(target.socket, { type: "closed", reason: "removed" });
    target.socket.close(REMOVED, "removed");
    this.drop(target.member.id);
  }

  private drop(id: string) {
    this.tell({ type: "left", id }, this.everyone().filter(({ member }) => member.id !== id).map(({ member }) => member.id));
  }

  webSocketClose(socket: WebSocket): void {
    const self = attached(socket);
    if (self) this.drop(self.id);
  }

  webSocketError(socket: WebSocket): void {
    this.webSocketClose(socket);
  }
}
