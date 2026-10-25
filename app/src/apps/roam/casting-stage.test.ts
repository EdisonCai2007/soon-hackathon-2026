/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Mesh, Object3D, type MeshBasicMaterial } from 'three'
import { expect, it } from 'vitest'
import { makeCastStage, type Cast } from './casting-stage'
import { parseScene } from './scene'
import { TECHNIQUES } from './techniques'

const scene = parseScene(JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8')))
const WHERE = { x: 1, y: -3.9, z: 2, yaw: 0 }
const cast = (over: Partial<Cast> = {}): Cast => ({ id: 'a1', technique: 'domain', at: 1000, where: WHERE, ...over })

const shown = (world: Object3D) => world.children.filter((child): child is Mesh => child instanceof Mesh && child.visible)
const fade = (mesh: Mesh) => (mesh.material as MeshBasicMaterial).opacity

it('draws nothing at all until somebody casts', () => {
  const world = new Object3D()
  const stage = makeCastStage(world, scene)
  expect(stage.draw([], 1000)).toBe(0)
  expect(world.children).toHaveLength(0)
  stage.dispose()
})

it('sweeps a domain out from where its caster stands, washing the view as it opens', () => {
  const world = new Object3D()
  const stage = makeCastStage(world, scene)
  const opening = stage.draw([cast()], 1000)
  expect(opening).toBe(1)
  const half = TECHNIQUES.domain.life / 2
  expect(stage.draw([cast()], 1000 + half)).toBe(0)
  const dome = shown(world)[0]
  expect(dome.position.x).toBe(WHERE.x)
  expect(dome.scale.x).toBeGreaterThan(1)
  expect(fade(dome)).toBeCloseTo(0.85)
  stage.dispose()
})

it('sends hollow purple the way its caster faces, and gathers before it does', () => {
  const world = new Object3D()
  const stage = makeCastStage(world, scene)
  const purple = cast({ technique: 'purple', where: { ...WHERE, yaw: Math.PI / 2 } })
  stage.draw([purple], 1000)
  // Two gathering points, one each side of the caster, before they meet.
  expect(shown(world).map((mesh) => Math.sign(mesh.position.x - WHERE.x)).sort()).toEqual([-1, 1])

  stage.draw([purple], 1000 + TECHNIQUES.purple.life * 0.9)
  const orb = shown(world)[0]
  expect(shown(world)).toHaveLength(1)
  // Facing a quarter turn, the orb has travelled along x rather than z.
  expect(orb.position.x).toBeGreaterThan(WHERE.x + 1)
  expect(orb.position.z).toBeCloseTo(WHERE.z)
  stage.dispose()
})

it('takes a cast away once its life is over, and disposes what drew it', () => {
  const world = new Object3D()
  const stage = makeCastStage(world, scene)
  stage.draw([cast()], 1000)
  expect(world.children.length).toBeGreaterThan(0)
  expect(stage.draw([cast()], 1000 + TECHNIQUES.domain.life)).toBe(0)
  expect(world.children).toHaveLength(0)
})

it('draws everybody who is casting at once, and clears them all on dispose', () => {
  const world = new Object3D()
  const stage = makeCastStage(world, scene)
  stage.draw([cast(), cast({ id: 'b2', technique: 'blue' })], 1000)
  expect(world.children.length).toBeGreaterThan(4)
  stage.dispose()
  expect(world.children).toHaveLength(0)
})
