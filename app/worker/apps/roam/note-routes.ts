// The place's routes: what is left in the scanned home, kept in the app's own database because this account has no
// object storage. The rules and caps are notes.ts's; this holds the statements. wiki/stack/places-and-notes.md
import { hashed, isNoteId, noteId, noteSecret, keeperKey, sameKey } from "./ids.ts";
import { ERRORS, isFull, isPlace, listed, MAX_UPLOAD, mediaBytes, readLeaving, type Fault, type Row } from "./notes.ts";

type Notes = Pick<Env, "DB">;

const noStore = { "Cache-Control": "no-store" };
// A note's bytes never change and its id is random, so they are kept for good wherever they are cached.
const forever = { "Cache-Control": "public, max-age=31536000, immutable" };

const fail = (code: Fault, status: number) =>
  Response.json({ error: { code, message: ERRORS[code] } }, { status, headers: noStore });

const session = (env: Notes) => env.DB.withSession("first-primary");

const COLUMNS = "id, kind, x, y, z, yaw, author, words, created_at, (media IS NOT NULL) AS media";

/** Everything left in a place, without the bytes: walking the home downloads only what somebody opens. */
async function notes(_request: Request, env: Notes, { url }: { url: URL }): Promise<Response> {
  const place = url.searchParams.get("place");
  if (!isPlace(place)) return fail("bad_place", 404);
  const found = await session(env).prepare(`SELECT ${COLUMNS} FROM roam_notes WHERE place = ?1 ORDER BY created_at`)
    .bind(place).all<Row>();
  return Response.json({ notes: found.results.map(listed) }, { headers: noStore });
}

/** One note's bytes, with the type they were left as. */
async function noteMedia(_request: Request, env: Notes, { url }: { url: URL }): Promise<Response> {
  const place = url.searchParams.get("place");
  const id = url.searchParams.get("id");
  if (!isPlace(place) || !isNoteId(id)) return fail("not_found", 404);
  const row = await session(env).prepare("SELECT media, media_type FROM roam_notes WHERE place = ?1 AND id = ?2")
    .bind(place, id).first<{ media: ArrayBuffer | Uint8Array | number[] | null; media_type: string | null }>();
  if (!row?.media || !row.media_type) return fail("not_found", 404);
  return new Response(mediaBytes(row.media), { headers: { ...forever, "Content-Type": row.media_type } });
}

/** A file a form carried, as the rules want it: its bytes and the type the recorder or camera gave it. */
async function filePart(part: File | string | null) {
  if (part === null || typeof part === "string") return null;
  return { bytes: new Uint8Array(await part.arrayBuffer()), type: part.type };
}

/** Leaves a note where the phone stood. The secret in the answer is the author's only way back to it. */
async function leaveNote(request: Request, env: Notes): Promise<Response> {
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_UPLOAD) return fail("too_large", 413);
  const form = await request.formData().catch(() => null);
  if (!form) return fail("bad_body", 400);
  const place = form.get("place");
  if (typeof place !== "string" || !isPlace(place)) return fail("bad_place", 404);
  let spot: unknown;
  try { spot = JSON.parse(String(form.get("spot"))); } catch { return fail("bad_position", 400); }
  const leaving = readLeaving({ kind: form.get("kind"), spot, author: form.get("author"), words: form.get("words"),
    media: await filePart(form.get("media")) });
  if (typeof leaving === "string") return fail(leaving, leaving === "too_large" ? 413 : 400);

  const db = session(env);
  // A count always answers with a row, however empty the place is.
  const count = await db.prepare("SELECT COUNT(*) AS held FROM roam_notes WHERE place = ?1").bind(place).first<{ held: number }>();
  if (isFull(count!.held)) return fail("full", 409);
  const id = noteId();
  const secret = noteSecret();
  await db.prepare(`INSERT INTO roam_notes (place, id, kind, x, y, z, yaw, author, words, media, media_type, secret_hash, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
    .bind(place, id, leaving.kind, leaving.spot.x, leaving.spot.y, leaving.spot.z, leaving.spot.yaw, leaving.author,
      leaving.words, leaving.media, leaving.mediaType, await hashed(secret), Date.now()).run();
  return Response.json({ id, secret }, { headers: noStore });
}

/** Whether a held secret is the note's own or the place's keeper's: nothing else removes a note. */
async function allowed(db: D1DatabaseSession, place: string, held: string, noteHash: string) {
  const given = await hashed(held);
  if (sameKey(given, noteHash)) return true;
  const keeper = await db.prepare("SELECT keeper_hash FROM roam_places WHERE place = ?1").bind(place).first<{ keeper_hash: string }>();
  return !!keeper && sameKey(given, keeper.keeper_hash);
}

/** Takes a note back. It can not be undone. */
async function removeNote(request: Request, env: Notes): Promise<Response> {
  const body = await request.json<{ place?: unknown; id?: unknown; secret?: unknown }>().catch(() => null);
  const place = typeof body?.place === "string" ? body.place : null;
  const id = typeof body?.id === "string" ? body.id : null;
  if (!isPlace(place) || !isNoteId(id) || typeof body?.secret !== "string") return fail("not_found", 404);
  const db = session(env);
  const row = await db.prepare("SELECT secret_hash FROM roam_notes WHERE place = ?1 AND id = ?2").bind(place, id)
    .first<{ secret_hash: string }>();
  if (!row) return fail("not_found", 404);
  if (!await allowed(db, place, body.secret, row.secret_hash)) return fail("refused", 403);
  await db.prepare("DELETE FROM roam_notes WHERE place = ?1 AND id = ?2").bind(place, id).run();
  return Response.json({ removed: id }, { headers: noStore });
}

/** Claims the place, once. Whoever holds the key it answers with can remove any note left there. */
async function claimPlace(request: Request, env: Notes): Promise<Response> {
  const body = await request.json<{ place?: unknown }>().catch(() => null);
  const place = typeof body?.place === "string" ? body.place : null;
  if (!isPlace(place)) return fail("bad_place", 404);
  const db = session(env);
  const held = await db.prepare("SELECT place FROM roam_places WHERE place = ?1").bind(place).first<{ place: string }>();
  if (held) return fail("claimed", 409);
  const key = keeperKey();
  try {
    await db.prepare("INSERT INTO roam_places (place, keeper_hash, created_at) VALUES (?1, ?2, ?3)")
      .bind(place, await hashed(key), Date.now()).run();
  } catch { return fail("claimed", 409); }
  return Response.json({ place, keeperKey: key }, { headers: noStore });
}

export const noteRoutes = { notes, noteMedia, leaveNote, removeNote, claimPlace };
