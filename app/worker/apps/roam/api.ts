// The ROAM app's server side: the main Worker sends /apps/roam/api/<route> here. Each room is one Durable
// Object named by its id, so a link reaches the same room from anywhere. wiki/stack/mini-apps.md
import type { Route } from "../../api/contract.ts";
import { isRoomId, roomId } from "./ids.ts";
import { noteRoutes } from "./note-routes.ts";

// `Env` is the Worker's own binding list; the dispatcher hands a handler its own copy of it.
type Rooms = Pick<Env, "ROAM_ROOMS">;

const noStore = { "Cache-Control": "no-store" };
const notFound = () => Response.json({ error: "Not found" }, { status: 404, headers: noStore });

const room = (env: Rooms, id: string) => env.ROAM_ROOMS.getByName(id);

/** Starts a room: the id goes in the shareable link, the key stays in the host's own browser. */
async function start(_request: Request, env: Rooms): Promise<Response> {
  const id = roomId();
  const made = await room(env, id).fetch(new Request("https://room/create", { method: "POST" }));
  if (!made.ok) return made;
  const { hostKey } = await made.json<{ hostKey: string }>();
  return Response.json({ roomId: id, hostKey }, { headers: noStore });
}

/** The room's socket. The upgrade is passed through untouched, so the browser gets its 101. */
function join(request: Request, env: Rooms, { url }: { url: URL }): Promise<Response> | Response {
  const id = url.searchParams.get("id");
  if (!isRoomId(id)) return notFound();
  const inner = new URL("https://room/socket");
  for (const field of ["name", "role"]) inner.searchParams.set(field, url.searchParams.get(field) ?? "");
  return room(env, id).fetch(new Request(inner, request));
}

/** Who is in a room, for the host's list. */
function members(_request: Request, env: Rooms, { url }: { url: URL }): Promise<Response> | Response {
  const id = url.searchParams.get("id");
  return isRoomId(id) ? room(env, id).fetch(new Request("https://room/members")) : notFound();
}

// Keyed "METHOD route". A Map, so a route like `constructor` can't reach a property every object inherits.
export const routes = new Map<string, Route>([
  ["POST room", start],
  ["GET socket", join],
  ["GET members", members],
  // The place and what is left in it: lasting, and read by anyone holding the app's own address.
  ["GET notes", noteRoutes.notes],
  ["GET note-media", noteRoutes.noteMedia],
  ["POST note", noteRoutes.leaveNote],
  ["DELETE note", noteRoutes.removeNote],
  ["POST place", noteRoutes.claimPlace],
]);
