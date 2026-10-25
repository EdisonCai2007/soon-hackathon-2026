// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Vector3 } from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import { playNote } from './note-sound'
import { parseScene } from './scene'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))
const SPOT = { x: 0, y: -3.9, z: 0, yaw: 0 }

const param = () => ({ setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
const chain = () => ({ connect: vi.fn((next: unknown) => next), disconnect: vi.fn() })

function soundCard({ places = true } = {}) {
  const source = { ...chain(), buffer: null as unknown, start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null }
  const gain = { ...chain(), gain: param() }
  const panner = { ...chain(), panningModel: '', distanceModel: '', rolloffFactor: 1,
    ...(places ? { positionX: param(), positionY: param(), positionZ: param() } : {}) }
  const context = { currentTime: 3, destination: {}, createBufferSource: () => source, createGain: () => gain,
    createPanner: () => panner, decodeAudioData: vi.fn(async () => ({ duration: 2 })) }
  return { context: context as unknown as AudioContext, source, gain, panner }
}

const answering = (answer: () => Response) => vi.stubGlobal('fetch', vi.fn(answer))
const bytes = () => new Response(new Uint8Array([1, 2, 3, 4]))

afterEach(() => vi.unstubAllGlobals())

it('starts a clip where it was left and turns it down as the ears move away', async () => {
  answering(bytes)
  const card = soundCard()
  const voice = await playNote(card.context, '/clip', SPOT, scene, () => {})
  expect(voice).not.toBeNull()
  expect(card.source.start).toHaveBeenCalled()
  expect(card.panner.panningModel).toBe('HRTF')
  expect(card.panner.positionZ!.setValueAtTime).toHaveBeenCalledWith(0, 3)

  voice!.hear(new Vector3(0, -3.9, 0.2))
  const close = card.gain.gain.setTargetAtTime.mock.calls.at(-1)![0] as number
  voice!.hear(new Vector3(0, -3.9, 20))
  const far = card.gain.gain.setTargetAtTime.mock.calls.at(-1)![0] as number
  expect(close).toBeGreaterThan(far)
})

it('places a clip the old way where the panner has no parameters', async () => {
  answering(bytes)
  const card = soundCard({ places: false })
  const voice = await playNote(card.context, '/clip', SPOT, scene, () => {})
  expect(voice).not.toBeNull()
  expect(card.source.start).toHaveBeenCalled()
})

it('stops once, and says nothing more once stopped', async () => {
  answering(bytes)
  const card = soundCard()
  const onEnd = vi.fn()
  const voice = await playNote(card.context, '/clip', SPOT, scene, onEnd)
  voice!.stop()
  voice!.stop()
  voice!.hear(new Vector3(0, 0, 0))
  expect(card.source.stop).toHaveBeenCalledTimes(1)
  expect(card.gain.disconnect).toHaveBeenCalledTimes(1)
  expect(card.source.onended).toBeNull()
  expect(card.gain.gain.setTargetAtTime).not.toHaveBeenCalled()
})

it('lets the page know when the clip runs out', async () => {
  answering(bytes)
  const card = soundCard()
  const onEnd = vi.fn()
  await playNote(card.context, '/clip', SPOT, scene, onEnd)
  card.source.onended!()
  expect(onEnd).toHaveBeenCalled()
})

it('stops a clip that already finished without complaining', async () => {
  answering(bytes)
  const card = soundCard()
  card.source.stop = vi.fn(() => { throw new Error('already done') })
  const voice = await playNote(card.context, '/clip', SPOT, scene, () => {})
  expect(() => voice!.stop()).not.toThrow()
})

it('plays nothing when the bytes are missing, unreachable, or not sound at all', async () => {
  const card = soundCard()
  answering(() => new Response('no', { status: 404 }))
  expect(await playNote(card.context, '/clip', SPOT, scene, () => {})).toBeNull()
  answering(() => { throw new Error('offline') })
  expect(await playNote(card.context, '/clip', SPOT, scene, () => {})).toBeNull()
  answering(bytes)
  vi.mocked(card.context.decodeAudioData).mockRejectedValueOnce(new Error('not sound'))
  expect(await playNote(card.context, '/clip', SPOT, scene, () => {})).toBeNull()
})
