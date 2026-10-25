// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { castsNow, useCasting, useCasts, useTechniqueSounds, type Casting } from './casting'
import type { Cast } from './casting-stage'
import type { Landmarker } from './hands'
import { nextMotion } from './pose-feed'
import type { Peer } from './presence'
import { parseScene } from './scene'
import type { Hand, Point } from './signs'
import { TECHNIQUES } from './techniques'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))
const WHERE = { x: 1, y: -3.9, z: 2, yaw: 0 }
const stream = () => ({ getTracks: () => [] }) as unknown as MediaStream

// The domain sign: the thumb's tip put exactly where the middle finger's is, with the others out.
const point = (x: number, y: number): Point => ({ x, y, z: 0 })
function domainHand(): Hand {
  const hand: Point[] = Array.from({ length: 21 }, () => point(0, 0))
  hand[9] = point(0, 1)
  for (const [joint, tip, away] of [[2, 4, -0.8], [6, 8, -0.3], [10, 12, 0], [14, 16, 0.3], [18, 20, 0.6]] as number[][]) {
    hand[joint] = point(away, 1)
    hand[tip] = point(away * 1.6, 1.6)
  }
  hand[4] = hand[12]
  return hand
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const landmarker = (hands: Hand[]): Landmarker => ({ detectForVideo: () => ({ landmarks: hands }), close: () => {} })

it('reads nothing until hand reading is turned on', async () => {
  vi.useFakeTimers()
  const cast = vi.fn()
  const { result } = renderHook(() => useCasting(stream(), cast, () => Promise.resolve(landmarker([domainHand()]))))
  expect(result.current.step).toBe('off')
  expect(result.current.seen).toBeNull()

  await act(async () => { result.current.turn() })
  expect(result.current.step).toBe('on')

  await act(async () => { await vi.advanceTimersByTimeAsync(500) })
  expect(result.current.seen).toBe(TECHNIQUES.domain.title)
  expect(cast).toHaveBeenCalledWith('domain')
  expect(result.current.mine).toMatchObject({ technique: 'domain' })
})

it('stops reading when it is turned off again', async () => {
  vi.useFakeTimers()
  const cast = vi.fn()
  const { result } = renderHook(() => useCasting(stream(), cast, () => Promise.resolve(landmarker([domainHand()]))))
  await act(async () => { result.current.turn() })
  await act(async () => { await vi.advanceTimersByTimeAsync(500) })
  await act(async () => { result.current.turn() })
  expect(result.current.step).toBe('off')
  expect(result.current.seen).toBeNull()
  const sofar = cast.mock.calls.length
  await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
  expect(cast.mock.calls).toHaveLength(sofar)
})

it('says so when there is no camera, or the landmarker will not start', async () => {
  const noCamera = renderHook(() => useCasting(null, vi.fn()))
  await act(async () => { noCamera.result.current.turn() })
  expect(noCamera.result.current.step).toBe('cannot')

  const refused = renderHook(() => useCasting(stream(), vi.fn(), () => Promise.reject(new Error('no WebAssembly'))))
  await act(async () => { refused.result.current.turn() })
  expect(refused.result.current.step).toBe('cannot')
})

const peer = (id: string, cast: Peer['cast'], moving = true): Peer => ({
  member: { id, name: id, color: '#f97362', role: 'guest', pose: null },
  motion: moving ? nextMotion(null, WHERE, 1000) : null, stream: null, cast,
})

it('places everybody else’s cast where they are, and this page’s own where it stands', () => {
  const theirs = peer('a1', { technique: 'purple', at: 1000 })
  expect(castsNow([theirs], null, null, 1000)).toEqual([{ id: 'a1', technique: 'purple', at: 1000, where: WHERE }])
  // Somebody who has not cast, and somebody who has never reported a position, are drawn nothing.
  expect(castsNow([peer('b2', null), peer('c3', { technique: 'blue', at: 1 }, false)], null, null, 1000)).toEqual([])
  expect(castsNow([], { technique: 'domain', at: 5 }, WHERE, 1000)).toEqual([{ id: 'me', technique: 'domain', at: 5, where: WHERE }])
  // This page's own cast is drawn only once it knows where it is standing.
  expect(castsNow([], { technique: 'domain', at: 5 }, null, 1000)).toEqual([])
})

it('rebuilds the list when somebody starts casting, not every time they move', () => {
  const still = peer('a1', null)
  const view = renderHook(({ peers, mine }: { peers: Peer[]; mine: Casting['mine'] }) => useCasts(peers, mine, WHERE),
    { initialProps: { peers: [still], mine: null } })
  expect(view.result.current).toEqual([])

  view.rerender({ peers: [peer('a1', { technique: 'blue', at: 300 })], mine: null })
  expect(view.result.current).toEqual([{ id: 'a1', technique: 'blue', at: 300, where: WHERE }])

  view.rerender({ peers: [still], mine: { technique: 'domain', at: 700 } })
  expect(view.result.current).toEqual([{ id: 'me', technique: 'domain', at: 700, where: WHERE }])

  // With nothing passed at all — the scan walked alone — there is nothing to draw.
  expect(renderHook(() => useCasts()).result.current).toEqual([])
})

const sounds = () => {
  const stopped: string[] = []
  const chain = () => ({ connect: (next: unknown) => next, disconnect: () => {} })
  const param = () => ({ setValueAtTime: () => {}, linearRampToValueAtTime: () => {} })
  const context = {
    currentTime: 0, sampleRate: 48000, destination: {},
    // Only the stop on the way out is counted: every sound also schedules its own, at the end of its life.
    createOscillator: () => ({ ...chain(), type: '', frequency: param(), start: () => {},
      stop: (at?: number) => { if (at === undefined) stopped.push('tone') } }),
    createGain: () => ({ ...chain(), gain: param() }),
    createPanner: () => ({ ...chain(), panningModel: '', distanceModel: '', rolloffFactor: 0 }),
    createBufferSource: () => ({ ...chain(), buffer: null as unknown, start: () => {} }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(4) }),
  }
  return { context: context as unknown as AudioContext, stopped }
}

const cast = (over: Partial<Cast> = {}): Cast => ({ id: 'a1', technique: 'blue', at: 0, where: WHERE, ...over })

it('starts each cast’s sound once and stops it when the cast is over', () => {
  const card = sounds()
  const { rerender, unmount } = renderHook(({ casts }: { casts: Cast[] }) => useTechniqueSounds(card.context, casts, scene, WHERE),
    { initialProps: { casts: [cast()] } })
  rerender({ casts: [cast()] })
  expect(card.stopped).toHaveLength(0)
  rerender({ casts: [] })
  expect(card.stopped).toEqual(['tone'])
  unmount()
})

it('plays nothing with no sound card, no scan, or nobody casting', () => {
  const card = sounds()
  renderHook(() => useTechniqueSounds(null, [cast()], scene, WHERE))
  renderHook(() => useTechniqueSounds(card.context, [cast()], null, WHERE))
  // With nowhere to hear from, a cast still plays, at the loudness of standing on it.
  const { unmount } = renderHook(() => useTechniqueSounds(card.context, [cast()], scene, null))
  unmount()
  expect(card.stopped).toEqual(['tone'])
})
