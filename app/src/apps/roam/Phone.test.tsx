// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { ArHooks } from './ar-session'
import type { Pose } from './messages'
import { Phone } from './Phone'
import { anchorAt, toScanPose } from './placement'
import { parseScene } from './scene'

const details: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))
const scene = parseScene(details)

// The AR session and the room are stood in: these tests drive the screen, not the phone.
const fakes = vi.hoisted(() => ({
  supported: true,
  starts: 0,
  fails: false,
  hooks: null as ArHooks | null,
  stops: 0,
  told: [] as Pose[],
  failure: null as string | null,
}))

vi.mock('./ar-session', () => ({
  arSupported: () => Promise.resolve(fakes.supported),
  startAr: (hooks: ArHooks) => {
    fakes.starts += 1
    if (fakes.fails) return Promise.reject(new Error('refused'))
    fakes.hooks = hooks
    return Promise.resolve({ stop: () => { fakes.stops += 1 } })
  },
}))

vi.mock('./live-room', () => ({
  useLiveRoom: () => ({ status: 'live', self: null, peers: [], capacity: 6, audio: null, soundBlocked: true,
    unlock: () => {}, tell: (pose: Pose) => fakes.told.push(pose), remove: () => {}, failure: fakes.failure }),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Object.assign(fakes, { supported: true, starts: 0, fails: false, hooks: null, stops: 0, told: [], failure: null })
})

const open = async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json(details))))
  await act(async () => { render(<Phone app="roam" roomId="r1" />) })
}
const button = (name: string) => screen.getByRole('button', { name })

it('asks to be lined up on the taped spot before it goes live', async () => {
  await open()
  expect(screen.getByText(/Stand on the marked spot/)).toBeTruthy()
  expect(button('I’m here')).toBeTruthy()
  expect(fakes.starts).toBe(0)
})

it('goes live once it is lined up, and reports where the phone is in the scan', async () => {
  await open()
  await act(async () => { fireEvent.click(button('I’m here')) })
  expect(screen.getByRole('status').textContent).toMatch(/You’re live/)

  await act(async () => { fakes.hooks!.onPose({ x: 0, y: 1.5, z: 2, yaw: 0 }) })
  expect(fakes.told).toEqual([toScanPose({ x: 0, y: 1.5, z: 2, yaw: 0 }, anchorAt(scene, 0), scene)])
})

it('says when the phone has lost the room, and clears it when tracking returns', async () => {
  await open()
  await act(async () => { fireEvent.click(button('I’m here')) })
  await act(async () => { fakes.hooks!.onLost() })
  expect(screen.getByText(/lost track of the room/)).toBeTruthy()
  await act(async () => { fakes.hooks!.onPose({ x: 0, y: 1.5, z: 0, yaw: 0 }) })
  expect(screen.queryByText(/lost track of the room/)).toBeNull()
})

it('stops when the person stops it, and when the phone ends the session itself', async () => {
  await open()
  await act(async () => { fireEvent.click(button('I’m here')) })
  await act(async () => { fireEvent.click(button('Stop')) })
  expect(fakes.stops).toBe(1)
  expect(button('I’m here')).toBeTruthy()

  await act(async () => { fireEvent.click(button('I’m here')) })
  await act(async () => { fakes.hooks!.onEnd() })
  expect(button('I’m here')).toBeTruthy()
})

it('offers the guest way in where the phone has no AR, and where it refuses to start', async () => {
  fakes.supported = false
  await open()
  expect(screen.getByText(/can’t follow you through the room/)).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Join as a guest' })).toHaveProperty('href', 'http://localhost:3000/apps/roam/r/r1')
  cleanup()

  Object.assign(fakes, { supported: true, fails: true })
  await open()
  await act(async () => { fireEvent.click(button('I’m here')) })
  expect(screen.getByText(/can’t follow you through the room/)).toBeTruthy()
})

it("waits for the scan's own details before offering to line up", async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))
  await act(async () => { render(<Phone app="roam" roomId="r1" />) })
  expect(screen.getByRole('status').textContent).toMatch(/Looking at what this phone can do/)
})

it('passes on what the room says went wrong', async () => {
  fakes.failure = 'This page needs your camera and microphone to put you in the room.'
  await open()
  expect(screen.getByText(fakes.failure)).toBeTruthy()
})
