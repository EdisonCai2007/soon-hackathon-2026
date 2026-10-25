// Which sign the hands in front of the camera are making, and whether it has been held long enough to fire.
// Pure geometry over the landmarks hands.ts reports, scaled by the hand's own size, so distance does not matter.
import { TECHNIQUES, type TechniqueName } from './techniques'

export type Point = { x: number; y: number; z: number }
/** One hand as twenty-one landmarks, in MediaPipe's order: 0 the wrist, 4 the thumb's tip, 8 the index's. */
export type Hand = readonly Point[]

const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, little: 20 } as const
const JOINT = { thumb: 2, index: 6, middle: 10, ring: 14, little: 18 } as const
type Finger = keyof typeof TIP
const FINGERS: Finger[] = ['thumb', 'index', 'middle', 'ring', 'little']
const WRIST = 0
const KNUCKLE = 9

const gap = (one: Point, two: Point) => Math.hypot(one.x - two.x, one.y - two.y, one.z - two.z)

/** The hand's own scale: its wrist to its middle finger's knuckle. */
export const handSize = (hand: Hand): number => gap(hand[WRIST], hand[KNUCKLE])

const extended = (hand: Hand, finger: Finger) =>
  gap(hand[TIP[finger]], hand[WRIST]) > gap(hand[JOINT[finger]], hand[WRIST]) * 1.15

const joined = (hand: Hand, one: Finger, two: Finger) => gap(hand[TIP[one]], hand[TIP[two]]) < handSize(hand) * 0.4

const spread = (hand: Hand) => gap(hand[TIP.index], hand[TIP.little]) > handSize(hand) * 0.8

const domain = (hand: Hand) => joined(hand, 'thumb', 'middle') && extended(hand, 'index') && extended(hand, 'little')

const purple = (one: Hand, two: Hand) =>
  extended(one, 'index') && extended(two, 'index') &&
  gap(one[TIP.index], two[TIP.index]) < Math.max(handSize(one), handSize(two))

const blue = (hand: Hand, pulled: boolean) => pulled && spread(hand) && FINGERS.every((finger) => extended(hand, finger))

/** The sign these hands are making, given whether the one hand has been pulled toward the camera. */
export function signOf(hands: readonly Hand[], pulled: boolean): TechniqueName | null {
  if (hands.length >= 2 && purple(hands[0], hands[1])) return 'purple'
  if (hands.length !== 1) return null
  if (domain(hands[0])) return 'domain'
  return blue(hands[0], pulled) ? 'blue' : null
}

// A sign has to survive this many frames in a row: every wave of a hand crosses one of the shapes above.
const HOLD = 4
// A hand pulled toward the camera grows; six frames is about a fifth of a second of reading.
const REMEMBER = 6
const GROWTH = 1.12

export type Watch = {
  /** The sign this frame shows, for the readout, whether or not it has been held. */
  seen: TechniqueName | null
  held: number
  /** Nothing fires before this time: the last cast's life and its wait. */
  until: number
  sizes: readonly number[]
}

export const freshWatch = (): Watch => ({ seen: null, held: 0, until: 0, sizes: [] })

/** One frame of hands: the watch as it now stands, and the technique this frame fired, if any. */
export function watchHands(state: Watch, hands: readonly Hand[], at: number): { state: Watch; fired: TechniqueName | null } {
  const sizes = hands.length === 1 ? [...state.sizes, handSize(hands[0])].slice(-REMEMBER) : []
  const pulled = sizes.length === REMEMBER && sizes[REMEMBER - 1] > sizes[0] * GROWTH
  const seen = signOf(hands, pulled)
  const held = seen !== null && seen === state.seen ? state.held + 1 : Number(seen !== null)
  if (seen !== null && held >= HOLD && at >= state.until) {
    const { life, wait } = TECHNIQUES[seen]
    return { state: { seen, held: 0, until: at + life + wait, sizes }, fired: seen }
  }
  return { state: { seen, held, until: state.until, sizes }, fired: null }
}
