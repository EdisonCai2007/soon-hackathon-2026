import { describe, expect, it } from 'vitest'
import { freshWatch, handSize, signOf, watchHands, type Hand, type Point } from './signs'

type Finger = 'thumb' | 'index' | 'middle' | 'ring' | 'little'
const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, little: 20 } as const
const JOINT = { thumb: 2, index: 6, middle: 10, ring: 14, little: 18 } as const
// Where each finger points from the wrist, with the wrist at the origin and the middle knuckle one unit up.
const AWAY: Record<Finger, [number, number]> = {
  thumb: [-0.8, 0.6], index: [-0.3, 0.95], middle: [0, 1], ring: [0.3, 0.95], little: [0.6, 0.8],
}
const FINGERS = Object.keys(AWAY) as Finger[]

const at = (x: number, y: number): Point => ({ x, y, z: 0 })
const along = ([x, y]: [number, number], far: number) => at(x * far, y * far)

/** A hand with every finger out, unless named in `curled`, and any tip put exactly where `tips` says. */
function makeHand({ curled = [], tips = {} }: { curled?: Finger[]; tips?: Partial<Record<Finger, Point>> } = {}): Hand {
  const hand: Point[] = Array.from({ length: 21 }, () => at(0, 0))
  hand[9] = at(0, 1)
  for (const finger of FINGERS) {
    hand[JOINT[finger]] = along(AWAY[finger], 1)
    hand[TIP[finger]] = tips[finger] ?? along(AWAY[finger], curled.includes(finger) ? 0.9 : 1.6)
  }
  return hand
}

const domainHand = () => makeHand({ tips: { thumb: along(AWAY.middle, 1.6) } })
const pointingHand = (shift = 0) => {
  const hand = makeHand({ curled: ['middle', 'ring', 'little'] })
  return hand.map((point, index) => (index === TIP.index ? at(point.x + shift, point.y) : point))
}

describe('what a hand is making', () => {
  it('measures a hand by its own wrist and knuckle', () => {
    expect(handSize(makeHand())).toBeCloseTo(1)
  })

  it('reads the domain sign from thumb and middle finger joined', () => {
    expect(signOf([domainHand()], false)).toBe('domain')
  })

  it('reads nothing from a hand held open but not pulled', () => {
    expect(signOf([makeHand()], false)).toBe(null)
  })

  it('reads nothing from a hand with the thumb away from the middle finger', () => {
    expect(signOf([makeHand({ curled: ['thumb', 'ring', 'little'] })], false)).toBe(null)
  })

  it('reads hollow purple from two index fingers brought together', () => {
    expect(signOf([pointingHand(), pointingHand(0.2)], false)).toBe('purple')
  })

  it('reads nothing from two hands held apart', () => {
    expect(signOf([pointingHand(), pointingHand(4)], false)).toBe(null)
  })

  it('reads nothing from two hands with their index fingers curled', () => {
    expect(signOf([makeHand({ curled: FINGERS }), makeHand({ curled: FINGERS })], false)).toBe(null)
  })

  it('reads the blue from an open hand that has been pulled closer', () => {
    expect(signOf([makeHand()], true)).toBe('blue')
  })

  it('reads nothing from a pulled hand that is not open', () => {
    expect(signOf([makeHand({ curled: ['index', 'middle'] })], true)).toBe(null)
  })

  it('reads nothing from no hands at all', () => {
    expect(signOf([], true)).toBe(null)
  })
})

// A hand coming toward the camera grows; six frames of the same size is a hand standing still.
const growing = (frame: number): Hand => makeHand().map((point) => at(point.x * (1 + frame * 0.05), point.y * (1 + frame * 0.05)))

function feed(frames: readonly Hand[][], at = 0) {
  let state = freshWatch()
  const fired: (string | null)[] = []
  for (const hands of frames) {
    const step = watchHands(state, hands, at)
    state = step.state
    fired.push(step.fired)
  }
  return { state, fired }
}

describe('holding a sign', () => {
  it('fires nothing until the sign has been held', () => {
    const { fired, state } = feed([[domainHand()], [domainHand()], [domainHand()]])
    expect(fired).toEqual([null, null, null])
    expect(state.seen).toBe('domain')
  })

  it('fires once the sign has been held, and not again on the next frame', () => {
    const { fired } = feed(Array.from({ length: 6 }, () => [domainHand()]))
    expect(fired).toEqual([null, null, null, 'domain', null, null])
  })

  it('starts counting again when the sign changes', () => {
    const frames = [[domainHand()], [domainHand()], [domainHand()], [pointingHand(), pointingHand(0.2)]]
    const { fired, state } = feed(frames)
    expect(fired).toEqual([null, null, null, null])
    expect(state.seen).toBe('purple')
    expect(state.held).toBe(1)
  })

  it('forgets a sign once the hands are gone', () => {
    const { state } = feed([[domainHand()], []])
    expect(state.seen).toBe(null)
    expect(state.held).toBe(0)
  })

  it('refuses a second cast until the technique and its wait are over', () => {
    let state = freshWatch()
    for (let frame = 0; frame < 4; frame += 1) state = watchHands(state, [domainHand()], 1000).state
    const tooSoon = watchHands(state, [domainHand()], 1000)
    expect(tooSoon.fired).toBe(null)
    expect(state.until).toBe(7000)
  })

  it('fires again once the wait has passed', () => {
    let state = freshWatch()
    for (let frame = 0; frame < 4; frame += 1) state = watchHands(state, [domainHand()], 0).state
    let last: string | null = null
    for (let frame = 0; frame < 4; frame += 1) {
      const step = watchHands(state, [domainHand()], 6000)
      state = step.state
      last = step.fired
    }
    expect(last).toBe('domain')
  })

  it('fires the blue from a hand growing across frames', () => {
    const { fired } = feed(Array.from({ length: 9 }, (_, frame) => [growing(frame)]))
    expect(fired.filter((one) => one !== null)).toEqual(['blue'])
  })
})
