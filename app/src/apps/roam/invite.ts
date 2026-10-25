// The room lives in the address: /apps/roam/ walks the scan and reads what is left in it, r/<id> joins a room,
// phone/<id> is the camera in the real room, and leave is the phone leaving notes, which needs no room.
export type Arrival =
  | { kind: 'alone' }
  | { kind: 'guest'; roomId: string }
  | { kind: 'camera'; roomId: string }
  | { kind: 'leave' }

const ROOM_ID = /^[0-9a-f]{20}$/
const PREFIX: Record<string, 'guest' | 'camera'> = { r: 'guest', phone: 'camera' }

export const isRoomId = (value: string): boolean => ROOM_ID.test(value)

/** What the address after /apps/<name>/ asks for. Anything unrecognised walks the scan alone. */
export function arrivalFrom(tail: string | undefined): Arrival {
  const [prefix, roomId, ...rest] = (tail ?? '').split('/').filter((part) => part !== '')
  if (prefix === 'leave' && roomId === undefined) return { kind: 'leave' }
  const kind = PREFIX[prefix]
  if (!kind || !roomId || rest.length || !isRoomId(roomId)) return { kind: 'alone' }
  return { kind, roomId }
}

const linkTo = (origin: string, app: string, prefix: string, roomId: string) => `${origin}/apps/${app}/${prefix}/${roomId}`

/** The link the host shares, and the one a phone in the room opens. */
export const inviteLink = (origin: string, app: string, roomId: string): string => linkTo(origin, app, 'r', roomId)
export const cameraLink = (origin: string, app: string, roomId: string): string => linkTo(origin, app, 'phone', roomId)

/** The link a phone opens to leave notes in the place, which belongs to no room. */
export const leaveLink = (origin: string, app: string): string => `${origin}/apps/${app}/leave`
