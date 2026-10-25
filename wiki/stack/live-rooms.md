# Live rooms in a mini app

A page where several people share one space at once — positions, presence, and live camera and voice — runs on one [Durable Object](https://developers.cloudflare.com/durable-objects/) per room and direct browser-to-browser video. The ROAM app at `app/worker/apps/roam/` is the worked example.

## The shape

- **One object per room, named by the room's id.** `env.ROAM_ROOMS.getByName(id)` reaches the same room from every page, and rooms can not touch each other. The object holds the member list, relays positions, passes the connection handshake between two named members, and enforces the room's limit.
- **Hibernatable sockets.** `state.acceptWebSocket(server)` and the `webSocketMessage`, `webSocketClose` and `webSocketError` handlers, with each member kept on their own socket by `serializeAttachment`. Nothing is held in memory between messages, so a quiet room costs nothing.
- **Media never touches the server.** Each browser sends its camera to every other browser. The cost grows with the square of the room, so a handful of people is the limit; past that, an SFU such as Cloudflare Realtime is the next step.
- **The room's rules are pure functions** in their own file, and the object is the shell that holds sockets and calls them. That is what keeps [every line tested](mini-apps.md#the-rules) over code whose real runtime is workerd.

## Write the class so the test suite can open it

Export a plain class that implements the global `DurableObject` interface instead of extending the base class from `cloudflare:workers`:

```ts
export class RoamRoom implements DurableObject {
  // ... fetch, webSocketMessage, webSocketClose, webSocketError
}
```

The runtime calls those methods by name, so a subclass buys nothing, and the import is what would stop the Node-side suite from constructing the class with a stand-in state and stand-in sockets. The suite then drives a whole room — join, relay, leave, refuse — with no runtime at all, and [the runtime suite](testing.md) opens one real room in workerd to prove the wiring.

Two things the Node suite must stand in for, because Node refuses them: `WebSocketPair`, which does not exist, and a `Response` with status 101, which Node's own `Response` rejects.

## The binding

A Durable Object binding is **not inherited by environments**, so it is repeated under every `env.*` in `app/wrangler.jsonc`, while the `exports` entry that declares the class is top level:

```jsonc
{
  "durable_objects": { "bindings": [{ "name": "ROAM_ROOMS", "class_name": "RoamRoom" }] },
  "exports": { "RoamRoom": { "type": "durable-object", "storage": "sqlite" } }
}
```

New namespaces use the SQLite backend; the older `migrations` array is the legacy flow and a Worker uses one or the other, never both. The class reaches the runtime only from the Worker's entry, so `app/worker/index.ts` re-exports it — the one line a mini app with a room adds outside its own folders. Run `npm run cf-typegen` after, and give the same binding to the runtime harness in `app/tests/runtime/setup.ts` so a test can open a room.

## A room costs the app its version previews

Cloudflare [does not generate a Version URL for a Worker that implements a Durable Object](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/#limitations), so from the first room onwards `scripts/cf-preview.sh` uploads a version that no alias can reach and reports no preview URL. Two consequences:

- A new class must be **deployed** once before any version can bind it: a version upload fails with *declared in `exports` but not yet provisioned*.
- A change is walked on the **staging Worker's own address** after `wrangler deploy --env staging`, not on a per-change alias.

## A socket from a mini app's API

`GET /apps/<name>/api/<route>` reaches a bare handler, and [the shared dispatcher](../../app/worker/api/contract.ts) hands a function route's response straight back, so the upgrade's 101 and its socket reach the browser untouched. Pass the request on to the object with `room.fetch(new Request(inner, request))`.

## What the browser side owns

- **Exactly one side of each pair offers**, decided by comparing the two member ids, so no lock and no clash.
- **Positions go up on a gate and are smoothed on the way in** — ten a second, interpolated between the last two — so figures glide rather than step.
- **A remote stream needs an element.** Chrome will not let Web Audio pull from a remote `MediaStream` until a hidden, muted `<audio>` element in the page is playing it.
- **Sound waits for a gesture.** The `AudioContext` starts suspended; resume it on the first press and say *sound off* until it runs.
- **A press updates world matrices before it raycasts.** A raycast reads the matrix the last frame left behind, and a press can land between frames; without the update, a figure on a fresh page is judged to stand in the middle of the room.

Part of [the Cloudflare stack](README.md). For a person physically in the room, see [AR in the browser](../development/ar-in-the-browser.md); for the hand signs people make inside a room, see [hands read in the browser](hand-signs.md).
