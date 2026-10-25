// The lasting place beside the live room: what people leave standing in the real home, read by anyone who opens the
// app's own address. The caps and the rules are the server's, in app/worker/apps/roam/notes.ts.
import type { Pose } from './messages'

export type NoteKind = 'text' | 'voice' | 'photo'
export type Note = { id: string; kind: NoteKind; spot: Pose; author: string; words: string; media: boolean; createdAt: number }

/** One scan, one place. A second scan names its own. */
const PLACE = 'home'

const at = (app: string, route: string) => `/apps/${app}/api/${route}`

/** Where a note's own bytes are served. Its name is random and its bytes never change, so they are cached for good. */
export const mediaUrl = (app: string, id: string): string => at(app, `note-media?place=${PLACE}&id=${id}`)

/** Everything left here. A place that can not be read shows as empty, rather than stopping the room from loading. */
export async function readNotes(app: string): Promise<Note[]> {
  try {
    const response = await fetch(at(app, `notes?place=${PLACE}`))
    if (!response.ok) return []
    const { notes } = await response.json() as { notes: Note[] }
    return notes
  } catch { return [] }
}

export type Leaving = { kind: NoteKind; spot: Pose; author: string; words: string; media: Blob | null }
export type Left = { ok: true; id: string } | { ok: false; fault: string }

/** Leaves a note where the phone stood, keeping the secret that can take it back in this browser alone. */
export async function leaveNote(app: string, leaving: Leaving): Promise<Left> {
  const form = new FormData()
  for (const [field, value] of [['place', PLACE], ['kind', leaving.kind], ['author', leaving.author],
    ['words', leaving.words], ['spot', JSON.stringify(leaving.spot)]]) form.append(field, value)
  if (leaving.media) form.append('media', leaving.media, 'note')
  try {
    const response = await fetch(at(app, 'note'), { method: 'POST', body: form })
    const answer = await response.json() as { id?: string; secret?: string; error?: { code?: string } }
    if (!response.ok || !answer.id || !answer.secret) return { ok: false, fault: answer.error?.code ?? 'refused' }
    keep(SECRET(answer.id), answer.secret)
    return { ok: true, id: answer.id }
  } catch { return { ok: false, fault: 'offline' } }
}

/** Takes a note back, with whichever of the two secrets this browser holds. It can not be undone. */
export async function removeNote(app: string, id: string): Promise<boolean> {
  const secret = secretFor(id) ?? keeperKey()
  if (secret === null) return false
  try {
    const response = await fetch(at(app, 'note'), { method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ place: PLACE, id, secret }) })
    if (response.ok) drop(SECRET(id))
    return response.ok
  } catch { return false }
}

/** Claims the place for this browser, once. Whoever holds the key can take back any note left here. */
export async function claimPlace(app: string): Promise<boolean> {
  try {
    const response = await fetch(at(app, 'place'), { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ place: PLACE }) })
    if (!response.ok) return false
    const { keeperKey: key } = await response.json() as { keeperKey: string }
    keep(KEEPER, key)
    return true
  } catch { return false }
}

const SECRET = (id: string) => `roam-note-${id}`
const KEEPER = `roam-keeper-${PLACE}`

// A browser with no storage still leaves notes; it just can not take them back afterwards.
const kept = (key: string): string | null => {
  try { return localStorage.getItem(key) }
  catch { return null }
}
const keep = (key: string, value: string): void => {
  try { localStorage.setItem(key, value) }
  catch { /* nothing to keep it in */ }
}
const drop = (key: string): void => {
  try { localStorage.removeItem(key) }
  catch { /* nothing to drop it from */ }
}

export const secretFor = (id: string): string | null => kept(SECRET(id))
export const keeperKey = (): string | null => kept(KEEPER)

/** Whether this browser can take a note back: it left the note, or it keeps the place. */
export const removable = (id: string): boolean => secretFor(id) !== null || keeperKey() !== null

/** What a note says in a line, for a list or a label. */
export const describe = (note: Note): string =>
  note.kind === 'text' ? note.words : note.kind === 'voice' ? 'A few words out loud' : 'A photo'
