// What a cast looks like inside the scan: a group of its own, beside the figures rather than among them,
// so stage.ts holds the room's people and this holds what happens over them. techniques.ts owns the numbers.
import { AdditiveBlending, Mesh, MeshBasicMaterial, SphereGeometry, type Object3D } from 'three'
import type { Pose } from './messages'
import { unitsPerMetre } from './placement'
import type { Scene } from './scene'
import { lookOf, through, TECHNIQUES, type TechniqueName } from './techniques'

/** One cast being drawn: who made it, when, and where they were standing as it started. */
export type Cast = { id: string; technique: TechniqueName; at: number; where: Pose }

export type CastStage = {
  /** Draws every cast still running and returns the strongest wash over the whole view, 0 to 1. */
  draw: (casts: readonly Cast[], now: number) => number
  dispose: () => void
}

type Parts = { dome: Mesh; orb: Mesh; left: Mesh; right: Mesh }

const key = (cast: Cast) => `${cast.id}:${cast.at}`

const ball = (world: Object3D, geometry: SphereGeometry, color: string, wireframe: boolean): Mesh => {
  const mesh = new Mesh(geometry, new MeshBasicMaterial({ color, transparent: true, opacity: 0, wireframe,
    blending: wireframe ? undefined : AdditiveBlending, depthWrite: false }))
  mesh.visible = false
  world.add(mesh)
  return mesh
}

const show = (mesh: Mesh, size: number, opacity: number) => {
  mesh.visible = opacity > 0 && size > 0
  mesh.scale.setScalar(Math.max(size, 0.0001))
  ;(mesh.material as MeshBasicMaterial).opacity = opacity
}

export function makeCastStage(world: Object3D, scene: Scene): CastStage {
  const scale = unitsPerMetre(scene)
  const unit = new SphereGeometry(1, 24, 16)
  const drawn = new Map<string, Parts>()

  const add = (cast: Cast): Parts => {
    const color = TECHNIQUES[cast.technique].color
    const parts: Parts = {
      dome: ball(world, unit, '#c58cff', true),
      orb: ball(world, unit, color, false),
      left: ball(world, unit, '#f97362', false),
      right: ball(world, unit, '#4fb8ff', false),
    }
    drawn.set(key(cast), parts)
    return parts
  }

  const drop = (id: string, parts: Parts) => {
    for (const mesh of [parts.dome, parts.orb, parts.left, parts.right]) {
      world.remove(mesh)
      ;(mesh.material as MeshBasicMaterial).dispose()
    }
    drawn.delete(id)
  }

  return {
    draw(casts, now) {
      const here = new Set<string>()
      let wash = 0
      for (const cast of casts) {
        const part = through(cast.technique, cast.at, now)
        if (part === null) continue
        here.add(key(cast))
        const parts = drawn.get(key(cast)) ?? add(cast)
        const look = lookOf(cast.technique, part)
        const { x, y, z, yaw } = cast.where
        const high = y + scale
        wash = Math.max(wash, look.glow)
        parts.dome.position.set(x, high, z)
        show(parts.dome, look.dome * scale, look.domeFade)
        // The orb travels the way its caster faces, so it crosses the room rather than hanging over them.
        parts.orb.position.set(x + Math.sin(yaw) * look.reach * scale, high, z + Math.cos(yaw) * look.reach * scale)
        show(parts.orb, look.orb * scale, look.orbFade)
        for (const [mesh, side] of [[parts.left, -1], [parts.right, 1]] as [Mesh, number][]) {
          mesh.position.set(x + side * look.gather * scale, high, z)
          show(mesh, 0.22 * scale, look.gatherFade)
        }
      }
      for (const [id, parts] of [...drawn]) if (!here.has(id)) drop(id, parts)
      return wash
    },

    dispose() {
      for (const [id, parts] of [...drawn]) drop(id, parts)
      unit.dispose()
    },
  }
}
