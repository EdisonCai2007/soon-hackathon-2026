// @vitest-environment jsdom
/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ArViewHooks } from './ar-view'
import type { Pose as Stance } from './messages'
import { anchorAt, unitsPerMetre } from './placement'
import { parseScene } from './scene'
import { useRoomAr } from './use-room-ar'

const made = vi.hoisted(() => ({
  views: [] as { hooks: ArViewHooks; lineUp: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn>; show: ReturnType<typeof vi.fn>; shown: () => boolean; take: ReturnType<typeof vi.fn> }[],
  sessions: [] as { stop: ReturnType<typeof vi.fn>; overlaid: boolean }[],
  started: [] as { overlay: unknown; onEnd: () => void }[],
  supported: true,
  refuse: false,
}))

vi.mock('./ar-session', () => ({
  arSupported: vi.fn(async () => made.supported),
  startAr: vi.fn(async (hooks: { onPose: (pose: unknown) => void; onLost: () => void; onEnd: () => void }, overlay: unknown) => {
    if (made.refuse) throw new Error('refused')
    // A session handed a drawing reports through it, so these two are handed in and never used: proved here.
    hooks.onPose({ x: 0, y: 0, z: 0, yaw: 0 })
    hooks.onLost()
    made.started.push({ overlay, onEnd: hooks.onEnd })
    const session = { stop: vi.fn(), overlaid: true }
    made.sessions.push(session)
    return session
  }),
}))

vi.mock('./ar-view', () => ({
  makeArView: vi.fn((_url: string, hooks: ArViewHooks) => {
    const view = { hooks, lineUp: vi.fn(), dispose: vi.fn(), show: vi.fn(), shown: () => true, take: vi.fn() }
    made.views.push(view)
    return view
  }),
}))

const details: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))
const scene = parseScene(details)
const spot = anchorAt(scene, 0)
const standing: Stance = { x: spot.x, y: spot.floor + 1.2, z: spot.z, yaw: spot.yaw }

let clock = 0
beforeEach(() => {
  clock = 0
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
})

afterEach(() => {
  vi.restoreAllMocks()
  made.views.length = 0
  made.sessions.length = 0
  made.started.length = 0
  made.supported = true
  made.refuse = false
})

const open = (hooks: Parameters<typeof useRoomAr>[2] = {}) => {
  const view = renderHook(() => useRoomAr('/apps/roam/room.spz', scene, hooks))
  return { ...view, walk: () => view.result.current }
}
const settle = async () => { await act(async () => { await Promise.resolve() }) }
const latest = () => made.views[made.views.length - 1]

it('is offered only where the phone can tell where it is', async () => {
  const yes = open()
  await settle()
  expect(yes.walk().offered).toBe(true)

  made.supported = false
  const no = open()
  await settle()
  expect(no.walk().offered).toBe(false)
})

it('starts from where the view already stood, and says so to the room ten times a second', async () => {
  const onStance = vi.fn()
  const overlay = { current: document.createElement('div') }
  const walking = open({ onStance, overlay })
  await settle()
  act(() => walking.walk().start(standing))
  expect(walking.walk().walking).toBe(true)
  await settle()
  expect(made.started[0].overlay).toBe(overlay.current)
  expect(latest().lineUp).toHaveBeenCalledWith({ x: spot.x, z: spot.z, yaw: spot.yaw, floor: spot.floor }, scene)

  // The first pose is the starting point itself, so it reports exactly where the view was looking from.
  act(() => latest().hooks.onPose!({ x: 0, y: 1.2, z: 0, yaw: 0 }))
  const first = onStance.mock.calls[0][0] as Stance
  expect(first.x).toBeCloseTo(spot.x, 6)
  expect(first.z).toBeCloseTo(spot.z, 6)
  expect(first.yaw).toBeCloseTo(spot.yaw, 6)

  // A second pose in the same tenth of a second is not relayed; one after it is.
  act(() => latest().hooks.onPose!({ x: 0, y: 1.2, z: 0.2, yaw: 0 }))
  expect(onStance).toHaveBeenCalledTimes(1)
  clock = 200
  act(() => latest().hooks.onPose!({ x: 0, y: 1.2, z: 1, yaw: 0 }))
  expect(onStance).toHaveBeenCalledTimes(2)
  // A metre walked is a metre of scan, along the way the spot faces.
  const after = onStance.mock.calls[1][0] as Stance
  const metre = unitsPerMetre(scene)
  expect(after.x).toBeCloseTo(spot.x + Math.sin(spot.yaw) * metre, 4)
  expect(after.z).toBeCloseTo(spot.z + Math.cos(spot.yaw) * metre, 4)
})

it('carries on from where the real floor ran out, keeping the place in the home', async () => {
  const onStance = vi.fn()
  const walking = open({ onStance })
  await settle()
  act(() => walking.walk().start(standing))
  await settle()
  act(() => latest().hooks.onPose!({ x: 0, y: 1.2, z: 0, yaw: 0 }))
  clock = 200
  act(() => latest().hooks.onPose!({ x: 0, y: 1.2, z: 2, yaw: 0 }))
  const reached = onStance.mock.calls[1][0] as Stance

  act(() => walking.walk().carryOn())
  expect(latest().lineUp).toHaveBeenLastCalledWith(
    { x: reached.x, z: reached.z, yaw: reached.yaw, floor: spot.floor }, scene)
  // Standing still after carrying on leaves them exactly where they had reached.
  clock = 400
  act(() => latest().hooks.onPose!({ x: 0, y: 1.2, z: 2, yaw: 0 }))
  const after = onStance.mock.calls[2][0] as Stance
  expect(after.x).toBeCloseTo(reached.x, 6)
  expect(after.z).toBeCloseTo(reached.z, 6)
})

it('comes back to the page looking where the walk got to', async () => {
  const onLeft = vi.fn()
  const walking = open({ onLeft })
  await settle()
  act(() => walking.walk().start(standing))
  await settle()
  act(() => latest().hooks.onPose!({ x: 0, y: 1.2, z: 0, yaw: 0 }))
  act(() => walking.walk().stop())
  expect(made.sessions[0].stop).toHaveBeenCalled()
  expect(latest().dispose).toHaveBeenCalled()
  expect(walking.walk().walking).toBe(false)
  expect(walking.walk().trouble).toBeNull()
  const back = onLeft.mock.calls[0][0] as { position: number[] }
  expect(back.position[0]).toBeCloseTo(spot.x, 6)
})

it('ends the walk and says why when the phone cannot carry it, or loses the view', async () => {
  for (const [why, said] of [['rate', /couldn’t draw/], ['lost', /3D view stopped/]] as const) {
    const walking = open()
    await settle()
    act(() => walking.walk().start(standing))
    await settle()
    act(() => latest().hooks.onGaveUp!(why))
    expect(walking.walk().walking).toBe(false)
    expect(walking.walk().trouble).toMatch(said)
    expect(latest().dispose).toHaveBeenCalled()
    walking.unmount()
  }
})

it('says so when the phone refuses the walk, and when the session ends on its own', async () => {
  made.refuse = true
  const refused = open()
  await settle()
  act(() => refused.walk().start(standing))
  await settle()
  expect(refused.walk().walking).toBe(false)
  expect(refused.walk().trouble).toMatch(/wouldn’t start/)

  made.refuse = false
  const walking = open()
  await settle()
  act(() => walking.walk().start(standing))
  await settle()
  act(() => made.started[0].onEnd())
  expect(walking.walk().walking).toBe(false)
  expect(walking.walk().trouble).toBeNull()
})

it('starts nothing twice, nothing without a scan, and nothing after the page has gone', async () => {
  const walking = open()
  await settle()
  act(() => walking.walk().start(standing))
  await settle()
  act(() => walking.walk().start(standing))
  expect(made.views).toHaveLength(1)

  const sceneless = renderHook(() => useRoomAr('/apps/roam/room.spz', null))
  await settle()
  act(() => sceneless.result.current.start(standing))
  act(() => sceneless.result.current.carryOn())
  expect(made.views).toHaveLength(1)

  walking.unmount()
  expect(latest().dispose).toHaveBeenCalled()
})

it('stops a session that arrives after the page has gone', async () => {
  const walking = open()
  await settle()
  act(() => walking.walk().start(standing))
  walking.unmount()
  await settle()
  expect(made.sessions[0].stop).toHaveBeenCalled()
})

it('carries on only while a walk is running', async () => {
  const walking = open()
  await settle()
  act(() => walking.walk().carryOn())
  expect(made.views).toHaveLength(0)
})
