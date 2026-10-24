import { expect, it, vi } from "vitest";
import { database } from "../../../tests/employee-access/connections.ts";
import type { AppHandler } from "../index.ts";
import { routes } from "./api.ts";
import { CAPS, MAX_UPLOAD } from "./notes.ts";

const SPOT = { x: 0.69, y: -2.34, z: -2.76, yaw: -0.4 };
const place = () => {
  const { sql, DB } = database();
  return { sql, env: { DB } as unknown as Parameters<AppHandler>[1] };
};
const route = (key: string) => routes.get(key) as AppHandler;

const call = (key: string, env: Parameters<AppHandler>[1], path: string, init?: RequestInit) => {
  const url = new URL(`https://site.example/apps/roam/api/${path}`);
  return route(key)(new Request(url, { method: key.split(" ")[0], ...init }), env, { url, route: path, identity: null });
};

const sending = (json: unknown) => ({ headers: { "content-type": "application/json" }, body: JSON.stringify(json) });

function form(fields: Record<string, string>, media?: { bytes: Uint8Array; type: string; name?: string }) {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  if (media) body.append("media", new File([media.bytes], media.name ?? "note", { type: media.type }));
  return { body };
}

const written = (words = "Mind the step.", over: Record<string, string> = {}) =>
  form({ place: "home", kind: "text", author: "Dana", words, spot: JSON.stringify(SPOT), ...over });

const leave = (env: Parameters<AppHandler>[1], init: RequestInit) => call("POST note", env, "note", init);
const listing = async (env: Parameters<AppHandler>[1], at = "notes?place=home") =>
  (await (await call("GET notes", env, at)).json()) as { notes: { id: string; kind: string; author: string; media: boolean }[] };

it("keeps a written note and reads it back where it was left", async () => {
  const { env } = place();
  const left = await leave(env, written());
  const { id, secret } = await left.json<{ id: string; secret: string }>();
  expect([left.status, id, secret]).toEqual([200, expect.stringMatching(/^[0-9a-f]{16}$/), expect.stringMatching(/^[0-9a-f]{48}$/)]);
  const { notes } = await listing(env);
  expect(notes).toEqual([{ id, kind: "text", spot: SPOT, author: "Dana", words: "Mind the step.", media: false,
    createdAt: expect.any(Number) }]);
});

it("keeps a spoken note's bytes and hands them back with their own type, cached for good", async () => {
  const { env } = place();
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const left = await leave(env, form({ place: "home", kind: "voice", author: "Dana", spot: JSON.stringify(SPOT) },
    { bytes, type: "audio/webm;codecs=opus" }));
  const { id } = await left.json<{ id: string }>();
  expect((await listing(env)).notes[0]).toMatchObject({ kind: "voice", media: true, words: "" });
  const got = await call("GET note-media", env, `note-media?place=home&id=${id}`);
  expect([got.status, got.headers.get("Content-Type"), got.headers.get("Cache-Control")])
    .toEqual([200, "audio/webm", "public, max-age=31536000, immutable"]);
  expect(new Uint8Array(await got.arrayBuffer())).toEqual(bytes);
});

it("has no bytes for a written note, an unknown note, or a place that does not exist", async () => {
  const { env } = place();
  const { id } = await (await leave(env, written())).json<{ id: string }>();
  for (const at of [`note-media?place=home&id=${id}`, `note-media?place=home&id=${"f".repeat(16)}`,
    "note-media?place=attic&id=" + "f".repeat(16), "note-media?place=home&id=nonsense"]) {
    const response = await call("GET note-media", env, at);
    expect([at, response.status]).toEqual([at, 404]);
  }
});

it("knows no place but its own", async () => {
  const { env } = place();
  expect((await call("GET notes", env, "notes?place=attic")).status).toBe(404);
  expect((await call("GET notes", env, "notes")).status).toBe(404);
  expect((await leave(env, written("Hello", { place: "attic" }))).status).toBe(404);
});

it("refuses a note that breaks a cap, and keeps nothing", async () => {
  const { env } = place();
  const tooMany = await leave(env, written("a".repeat(CAPS.words + 1)));
  expect([tooMany.status, (await tooMany.json<{ error: { code: string } }>()).error.code]).toEqual([400, "bad_words"]);
  const wrongFile = await leave(env, form({ place: "home", kind: "voice", author: "Dana", spot: JSON.stringify(SPOT) },
    { bytes: new Uint8Array(4), type: "application/zip" }));
  expect((await wrongFile.json<{ error: { code: string } }>()).error.code).toBe("bad_media");
  const big = await leave(env, form({ place: "home", kind: "photo", author: "Dana", spot: JSON.stringify(SPOT) },
    { bytes: new Uint8Array(CAPS.media + 1), type: "image/png" }));
  expect(big.status).toBe(413);
  expect((await listing(env)).notes).toEqual([]);
});

it("refuses a padded upload before reading it, and a body that is no form", async () => {
  const { env } = place();
  const padded = await leave(env, { headers: { "Content-Length": String(MAX_UPLOAD + 1) }, body: "x" });
  expect([padded.status, (await padded.json<{ error: { code: string } }>()).error.code]).toEqual([413, "too_large"]);
  const notAForm = await leave(env, { headers: { "content-type": "application/json" }, body: "{}" });
  expect([notAForm.status, (await notAForm.json<{ error: { code: string } }>()).error.code]).toEqual([400, "bad_body"]);
});

it("refuses a note whose spot is missing, unreadable, or outside the scan", async () => {
  const { env } = place();
  for (const spot of ["", "{oops", JSON.stringify({ x: 9999, y: 0, z: 0, yaw: 0 })]) {
    const response = await leave(env, written("Here", { spot }));
    expect([spot, response.status]).toEqual([spot, 400]);
  }
});

it("holds the place to its limit", async () => {
  const { sql, env } = place();
  const row = sql.prepare(`INSERT INTO roam_notes (place, id, kind, x, y, z, yaw, author, words, secret_hash, created_at)
    VALUES ('home', ?, 'text', 0, 0, 0, 0, 'Dana', 'filler', 'hash', 1)`);
  for (let at = 0; at < CAPS.notes; at++) row.run(at.toString(16).padStart(16, "0"));
  const response = await leave(env, written());
  expect([response.status, (await response.json<{ error: { code: string } }>()).error.code]).toEqual([409, "full"]);
});

it("lets whoever left a note take it back, and nobody else", async () => {
  const { env } = place();
  const { id, secret } = await (await leave(env, written())).json<{ id: string; secret: string }>();
  const wrong = await call("DELETE note", env, "note", sending({ place: "home", id, secret: "f".repeat(48) }));
  expect([wrong.status, (await wrong.json<{ error: { code: string } }>()).error.code]).toEqual([403, "refused"]);
  expect((await listing(env)).notes).toHaveLength(1);
  const gone = await call("DELETE note", env, "note", sending({ place: "home", id, secret }));
  expect([gone.status, await gone.json()]).toEqual([200, { removed: id }]);
  expect((await listing(env)).notes).toEqual([]);
});

it("lets the place's keeper take back a note they did not leave", async () => {
  const { env } = place();
  const claimed = await call("POST place", env, "place", sending({ place: "home" }));
  const { keeperKey } = await claimed.json<{ keeperKey: string }>();
  expect(keeperKey).toMatch(/^[0-9a-f]{48}$/);
  const { id } = await (await leave(env, written())).json<{ id: string }>();
  expect((await call("DELETE note", env, "note", sending({ place: "home", id, secret: keeperKey }))).status).toBe(200);
});

it("refuses a removal that names no note it holds", async () => {
  const { env } = place();
  for (const body of [{ place: "home", id: "f".repeat(16), secret: "x" }, { place: "attic", id: "f".repeat(16), secret: "x" },
    { place: "home", id: "nonsense", secret: "x" }, { place: "home", id: "f".repeat(16) }, { place: 7 }]) {
    const response = await call("DELETE note", env, "note", sending(body));
    expect([JSON.stringify(body), response.status]).toEqual([JSON.stringify(body), 404]);
  }
  expect((await call("DELETE note", env, "note", { headers: { "content-type": "application/json" }, body: "{oops" })).status).toBe(404);
});

it("claims a place once and never again", async () => {
  const { env } = place();
  expect((await call("POST place", env, "place", sending({ place: "home" }))).status).toBe(200);
  const second = await call("POST place", env, "place", sending({ place: "home" }));
  expect([second.status, (await second.json<{ error: { code: string } }>()).error.code]).toEqual([409, "claimed"]);
  expect((await call("POST place", env, "place", sending({ place: "attic" }))).status).toBe(404);
  expect((await call("POST place", env, "place", { headers: { "content-type": "application/json" }, body: "{oops" })).status).toBe(404);
});

it("treats two claims landing together as one, and keeps the first", async () => {
  const { env, sql } = place();
  // The second caller's own look found nothing, because the first had not written its row yet.
  const insert = sql.prepare.bind(sql);
  vi.spyOn(sql, "prepare").mockImplementation((query: string) => {
    if (query.startsWith("INSERT INTO roam_places")) throw new Error("UNIQUE constraint failed");
    return insert(query);
  });
  const response = await call("POST place", env, "place", sending({ place: "home" }));
  expect([response.status, (await response.json<{ error: { code: string } }>()).error.code]).toEqual([409, "claimed"]);
  vi.restoreAllMocks();
});
