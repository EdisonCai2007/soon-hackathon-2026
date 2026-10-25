/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
import { parseScene } from './scene'
import { playTechnique } from './technique-sound'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))
const WHERE = { x: 0, y: -3.9, z: 0, yaw: 0 }

const param = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() })
const chain = () => ({ connect: vi.fn((next: unknown) => next), disconnect: vi.fn() })

function soundCard({ places = true } = {}) {
  const tone = { ...chain(), type: '', frequency: param(), start: vi.fn(), stop: vi.fn() }
  const noise = { ...chain(), buffer: null as unknown, start: vi.fn(), stop: vi.fn() }
  const gain = { ...chain(), gain: param() }
  const panner = { ...chain(), panningModel: '', distanceModel: '', rolloffFactor: 1,
    ...(places ? { positionX: param(), positionY: param(), positionZ: param() } : {}) }
  const channel = new Float32Array(8)
  const context = {
    currentTime: 2, sampleRate: 48000, destination: {},
    createOscillator: () => tone, createGain: () => gain, createPanner: () => panner,
    createBufferSource: () => noise, createBuffer: vi.fn(() => ({ getChannelData: () => channel })),
  }
  return { context: context as unknown as AudioContext, tone, noise, gain, panner, channel }
}

it('starts a sound where its caster stands, swelling and fading across its life', () => {
  const card = soundCard()
  playTechnique(card.context, 'domain', WHERE, 0, scene)
  expect(card.tone.type).toBe('sawtooth')
  expect(card.tone.start).toHaveBeenCalledWith(2)
  expect(card.tone.frequency.setValueAtTime).toHaveBeenCalledWith(64, 2)
  expect(card.tone.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(28, 6)
  expect(card.gain.gain.setValueAtTime).toHaveBeenCalledWith(0, 2)
  expect(card.gain.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 6)
  expect(card.panner.panningModel).toBe('HRTF')
  expect(card.panner.positionY!.setValueAtTime).toHaveBeenCalledWith(WHERE.y, 2)
})

it('runs a rush of noise under the ones that have it, and none under the blue', () => {
  const withRush = soundCard()
  playTechnique(withRush.context, 'purple', WHERE, 0, scene)
  expect(withRush.noise.start).toHaveBeenCalled()
  expect(withRush.channel.some((sample) => sample !== 0)).toBe(true)

  const dry = soundCard()
  playTechnique(dry.context, 'blue', WHERE, 0, scene)
  expect(dry.noise.start).not.toHaveBeenCalled()
})

it('is quieter the further away the listener is', () => {
  const near = soundCard()
  playTechnique(near.context, 'blue', WHERE, 0, scene)
  const far = soundCard()
  playTechnique(far.context, 'blue', WHERE, 40, scene)
  const loudest = (card: ReturnType<typeof soundCard>) =>
    card.gain.gain.linearRampToValueAtTime.mock.calls[0][0] as number
  expect(loudest(near)).toBeGreaterThan(loudest(far))
})

it('places a sound the old way where the panner has no parameters', () => {
  const card = soundCard({ places: false })
  expect(() => playTechnique(card.context, 'blue', WHERE, 0, scene)).not.toThrow()
})

it('stops once, and does not mind a sound that already ran out', () => {
  const card = soundCard()
  const sound = playTechnique(card.context, 'blue', WHERE, 0, scene)
  sound.stop()
  sound.stop()
  expect(card.gain.disconnect).toHaveBeenCalledTimes(1)

  const ended = soundCard()
  // The scheduled stop is fine; the one on the way out finds a sound that has already run out.
  ended.tone.stop = vi.fn((at?: number) => { if (at === undefined) throw new Error('already over') })
  const over = playTechnique(ended.context, 'blue', WHERE, 0, scene)
  expect(() => over.stop()).not.toThrow()
})
