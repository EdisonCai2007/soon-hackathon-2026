import { useRef, useState, type PointerEvent } from 'react'
import { pushFrom, REACH_PX, STILL, type Push } from './thumb-pad'

/** The pad a thumb walks with, over the lower corner of the view. It keeps its own pointer, so the press never
 *  reaches the canvas behind it: dragging the view still looks, and a press begun here picks nobody. */
export function ThumbPad({ onPush }: { onPush: (push: Push) => void }) {
  const from = useRef<{ id: number; x: number; y: number } | null>(null)
  const [knob, setKnob] = useState<Push>(STILL)

  const moved = (push: Push) => {
    setKnob(push)
    onPush(push)
  }

  const start = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    from.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const held = from.current
    if (!held || held.id !== event.pointerId) return
    moved(pushFrom(held, { x: event.clientX, y: event.clientY }))
  }

  const release = () => {
    from.current = null
    moved(STILL)
  }

  return <div role="button" tabIndex={-1} aria-label="Move through the room"
    className="absolute bottom-4 left-4 z-20 grid size-28 touch-none place-items-center rounded-full border border-white/30 bg-black/30"
    onPointerDown={start} onPointerMove={drag} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
    <span className="size-10 rounded-full bg-white/70"
      style={{ transform: `translate(${knob.side * REACH_PX}px, ${-knob.forward * REACH_PX}px)` }} />
  </div>
}
