// What a thumb on the pad means as movement. The numbers live here and the drawing is in ThumbPad.tsx, so the
// maths is tested with no screen: openspec roam-ar-view, "A thumb to move with".

/** How far from the middle still counts as holding still, and how far is as far as the pad goes, in pixels. */
export const DEAD_PX = 6
export const REACH_PX = 48

/** Movement across the floor, each side between −1 and 1: the same pair the movement keys make. */
export type Push = { forward: number; side: number }

export const STILL: Push = { forward: 0, side: 0 }

type Point = { x: number; y: number }

/** Where a thumb has dragged from where it landed, as movement: nothing within the dead zone, growing to the
 *  pad's full reach and no further, so a small pull walks slowly. */
export function pushFrom(from: Point, to: Point, reach = REACH_PX): Push {
  const across = to.x - from.x
  const down = to.y - from.y
  const distance = Math.hypot(across, down)
  if (distance <= DEAD_PX) return STILL
  const strength = Math.min(1, (distance - DEAD_PX) / Math.max(reach - DEAD_PX, 1))
  return { forward: (-down / distance) * strength, side: (across / distance) * strength }
}
