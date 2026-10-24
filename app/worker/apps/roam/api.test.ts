import { expect, it } from "vitest";
import type { AppHandler } from "../index.ts";
import { routes } from "./api.ts";

type Asked = { url: string; method: string };

// The room itself, stood in: each call records the address the route built for it.
function rooms(answer: (asked: Asked) => Response) {
  const asked: (Asked & { name: string })[] = [];
  const env = {
    ROAM_ROOMS: {
      getByName: (name: string) => ({
        fetch: (request: Request) => {
          asked.push({ name, url: request.url, method: request.method });
          return Promise.resolve(answer({ url: request.url, method: request.method }));
        },
      }),
    },
  };
  return { asked, env: env as unknown as Parameters<AppHandler>[1] };
}

const route = (key: string) => routes.get(key) as AppHandler;

const call = (handler: AppHandler, env: Parameters<AppHandler>[1], path: string, init?: RequestInit) => {
  const url = new URL(`https://site.example/apps/roam/api/${path}`);
  return handler(new Request(url, init), env, { url, route: path, identity: null });
};

it("starts a room and answers with the id for the link and the key for the host", async () => {
  const { asked, env } = rooms(() => Response.json({ hostKey: "k".repeat(48) }));
  const response = await call(route("POST room"), env, "room", { method: "POST" });
  expect(await response.json()).toEqual({ roomId: expect.stringMatching(/^[0-9a-f]{20}$/), hostKey: "k".repeat(48) });
  expect(asked).toEqual([{ name: expect.stringMatching(/^[0-9a-f]{20}$/), url: "https://room/create", method: "POST" }]);
});

it("passes a refusal to start a room straight back", async () => {
  const { env } = rooms(() => Response.json({ error: "Room exists" }, { status: 409 }));
  const response = await call(route("POST room"), env, "room", { method: "POST" });
  expect([response.status, await response.json()]).toEqual([409, { error: "Room exists" }]);
});

it("joins the room the address names, carrying the name and role", async () => {
  const { asked, env } = rooms(() => new Response("upgraded"));
  const id = "0123456789abcdef0123";
  await call(route("GET socket"), env, `socket?id=${id}&name=Sam&role=camera`);
  expect(asked).toEqual([{ name: id, url: "https://room/socket?name=Sam&role=camera", method: "GET" }]);
  await call(route("GET socket"), env, `socket?id=${id}`);
  expect(asked[1].url).toBe("https://room/socket?name=&role=");
});

it("lists who is in the room the address names", async () => {
  const { asked, env } = rooms(() => Response.json({ members: [] }));
  const id = "0123456789abcdef0123";
  const response = await call(route("GET members"), env, `members?id=${id}`);
  expect(await response.json()).toEqual({ members: [] });
  expect(asked).toEqual([{ name: id, url: "https://room/members", method: "GET" }]);
});

it("knows no room by a name that is not a room id, and asks none", async () => {
  const { asked, env } = rooms(() => new Response("never"));
  for (const [key, path] of [["GET socket", "socket"], ["GET members", "members"]]) {
    const response = await call(route(key), env, `${path}?id=../secrets`);
    expect([response.status, await response.json()]).toEqual([404, { error: "Not found" }]);
    const missing = await call(route(key), env, path);
    expect(missing.status).toBe(404);
  }
  expect(asked).toEqual([]);
});
