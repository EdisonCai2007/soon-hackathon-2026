/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
import { displayQuaternion, parseScene } from './scene'
import { loadSplats } from './splat-scene'

vi.mock('@sparkjsdev/spark', async () => {
  const { Object3D } = await vi.importActual<typeof import('three')>('three')
  class SplatMesh extends Object3D {
    options: unknown
    constructor(options: unknown) { super(); this.options = options }
  }
  return { SplatMesh }
})

const details: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../public/apps/roam/scene.json'), 'utf8'))
const scene = parseScene(details)

it('stands the scan upright, puts it in place, and passes the detail settings through', () => {
  const onProgress = vi.fn()
  const splats = loadSplats(scene, { url: '/apps/roam/room.spz', onProgress, lod: true })
  expect(splats.quaternion.toArray()).toEqual(displayQuaternion(scene).toArray())
  expect(splats.position.toArray()).toEqual(scene.translation)
  expect((splats as unknown as { options: { url: string; lod: boolean } }).options)
    .toMatchObject({ url: '/apps/roam/room.spz', lod: true })
})
