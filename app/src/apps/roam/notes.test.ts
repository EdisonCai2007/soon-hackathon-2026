// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { claimPlace, describe, keeperKey, leaveNote, mediaUrl, readNotes, removable, removeNote, secretFor, type Note } from './notes'

const NOTE: Note = { id: 'a'.repeat(16), kind: 'text', spot: { x: 1, y: 2, z: 3, yaw: 0 }, author: 'Dana',
  words: 'Mind the step.', media: false, createdAt: 1792828800000 }
const SPOT = NOTE.spot
const answering = (answer: (path: string, init?: RequestInit) => Response | Promise<Response>) =>
  vi.stubGlobal('fetch', vi.fn(answer))

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

it('names where a note’s own bytes are served', () => {
  expect(mediaUrl('roam', NOTE.id)).toBe(`/apps/roam/api/note-media?place=home&id=${NOTE.id}`)
})

it('reads everything left in the place', async () => {
  answering(() => Response.json({ notes: [NOTE] }))
  expect(await readNotes('roam')).toEqual([NOTE])
})

it('shows an unreadable place as empty rather than stopping the room', async () => {
  answering(() => new Response('no', { status: 500 }))
  expect(await readNotes('roam')).toEqual([])
  answering(() => { throw new Error('offline') })
  expect(await readNotes('roam')).toEqual([])
})

it('leaves a note and keeps the secret that takes it back', async () => {
  const sent: FormData[] = []
  answering((_path, init) => {
    sent.push(init!.body as FormData)
    return Response.json({ id: NOTE.id, secret: 'f'.repeat(48) })
  })
  const clip = new Blob([new Uint8Array([1, 2])], { type: 'audio/webm' })
  expect(await leaveNote('roam', { kind: 'voice', spot: SPOT, author: 'Dana', words: '', media: clip }))
    .toEqual({ ok: true, id: NOTE.id })
  expect(Object.fromEntries([...sent[0]].filter(([, value]) => typeof value === 'string')))
    .toEqual({ place: 'home', kind: 'voice', author: 'Dana', words: '', spot: JSON.stringify(SPOT) })
  expect(sent[0].get('media')).toBeInstanceOf(File)
  expect(secretFor(NOTE.id)).toBe('f'.repeat(48))
})

it('gives the fault back when a note is refused, and says so when there is no answer at all', async () => {
  answering(() => Response.json({ error: { code: 'too_large' } }, { status: 413 }))
  expect(await leaveNote('roam', { kind: 'text', spot: SPOT, author: 'Dana', words: 'Hi', media: null }))
    .toEqual({ ok: false, fault: 'too_large' })
  answering(() => Response.json({}, { status: 500 }))
  expect(await leaveNote('roam', { kind: 'text', spot: SPOT, author: 'Dana', words: 'Hi', media: null }))
    .toEqual({ ok: false, fault: 'refused' })
  answering(() => { throw new Error('offline') })
  expect(await leaveNote('roam', { kind: 'text', spot: SPOT, author: 'Dana', words: 'Hi', media: null }))
    .toEqual({ ok: false, fault: 'offline' })
})

it('takes a note back with the secret this browser holds, and with the keeper’s key otherwise', async () => {
  const sent: string[] = []
  answering((_path, init) => {
    sent.push(String(init!.body))
    return Response.json({ removed: NOTE.id })
  })
  expect(await removeNote('roam', NOTE.id)).toBe(false)

  localStorage.setItem(`roam-note-${NOTE.id}`, 'mine')
  expect(await removeNote('roam', NOTE.id)).toBe(true)
  expect(JSON.parse(sent[0])).toEqual({ place: 'home', id: NOTE.id, secret: 'mine' })
  expect(secretFor(NOTE.id)).toBeNull()

  localStorage.setItem('roam-keeper-home', 'keeper')
  expect(await removeNote('roam', NOTE.id)).toBe(true)
  expect(JSON.parse(sent[1]).secret).toBe('keeper')
})

it('keeps a refused or unreachable removal as a failure, and keeps the secret', async () => {
  localStorage.setItem(`roam-note-${NOTE.id}`, 'mine')
  answering(() => new Response('no', { status: 403 }))
  expect(await removeNote('roam', NOTE.id)).toBe(false)
  expect(secretFor(NOTE.id)).toBe('mine')
  answering(() => { throw new Error('offline') })
  expect(await removeNote('roam', NOTE.id)).toBe(false)
})

it('claims the place once, and says so when it cannot', async () => {
  answering(() => Response.json({ keeperKey: 'k'.repeat(48) }))
  expect(await claimPlace('roam')).toBe(true)
  expect(keeperKey()).toBe('k'.repeat(48))
  answering(() => Response.json({ error: { code: 'claimed' } }, { status: 409 }))
  expect(await claimPlace('roam')).toBe(false)
  answering(() => { throw new Error('offline') })
  expect(await claimPlace('roam')).toBe(false)
})

it('knows which notes this browser can take back', () => {
  expect(removable(NOTE.id)).toBe(false)
  localStorage.setItem(`roam-note-${NOTE.id}`, 'mine')
  expect(removable(NOTE.id)).toBe(true)
  localStorage.clear()
  localStorage.setItem('roam-keeper-home', 'keeper')
  expect(removable(NOTE.id)).toBe(true)
})

it('still leaves notes in a browser with no storage, and forgets them', async () => {
  const refuse = () => { throw new Error('no storage') }
  vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse, removeItem: refuse })
  answering(() => Response.json({ id: NOTE.id, secret: 'f'.repeat(48) }))
  expect(await leaveNote('roam', { kind: 'text', spot: SPOT, author: 'Dana', words: 'Hi', media: null }))
    .toEqual({ ok: true, id: NOTE.id })
  expect(secretFor(NOTE.id)).toBeNull()
  expect(removable(NOTE.id)).toBe(false)
  expect(await removeNote('roam', NOTE.id)).toBe(false)
  answering(() => Response.json({ keeperKey: 'k' }))
  expect(await claimPlace('roam')).toBe(true)
})

it('says what a note is in a line', () => {
  expect(describe(NOTE)).toBe('Mind the step.')
  expect(describe({ ...NOTE, kind: 'voice' })).toBe('A few words out loud')
  expect(describe({ ...NOTE, kind: 'photo' })).toBe('A photo')
})
