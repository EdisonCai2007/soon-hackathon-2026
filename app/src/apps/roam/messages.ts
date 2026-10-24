// What the page accepts off the room's socket. The room checks what it relays; this checks what arrives,
// so a page never draws a figure from a message it could not read.
import { z } from 'zod'

const poseSchema = z.object({ x: z.number(), y: z.number(), z: z.number(), yaw: z.number() })

const memberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().min(1),
  role: z.enum(['guest', 'camera']),
  pose: poseSchema.nullable(),
})

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('welcome'), self: memberSchema, members: z.array(memberSchema), capacity: z.number().int().positive() }),
  z.object({ type: z.literal('joined'), member: memberSchema }),
  z.object({ type: z.literal('left'), id: z.string().min(1) }),
  z.object({ type: z.literal('pose'), id: z.string().min(1), pose: poseSchema }),
  z.object({ type: z.literal('signal'), from: z.string().min(1), data: z.unknown() }),
  z.object({ type: z.literal('closed'), reason: z.enum(['full', 'removed']) }),
])

export type Pose = z.infer<typeof poseSchema>
export type Member = z.infer<typeof memberSchema>
export type RoomMessage = z.infer<typeof messageSchema>

/** The message, or null for anything the page will not act on. */
export function readRoomMessage(raw: unknown): RoomMessage | null {
  if (typeof raw !== 'string') return null
  try {
    const parsed = messageSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/** What this page sends: its own position, a handshake for one other person, or a removal as the host. */
export type Sent =
  | { type: 'pose'; pose: Pose }
  | { type: 'signal'; to: string; data: unknown }
  | { type: 'remove'; id: string; key: string }
