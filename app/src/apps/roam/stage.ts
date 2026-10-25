// The people inside the 3D world: a camera-facing plane each, their video on it, and their voice placed by
// where they stand. placement.ts and audio.ts own the numbers; this holds what the GPU and sound card need.
import { Euler, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, VideoTexture, type Object3D, type PerspectiveCamera, type Vector2 } from 'three'
import { gainFor, listenerFrom, rangeFor, type Range } from './audio'
import type { Pose } from './messages'
import { playNow } from './play'
import { billboardYaw, figureSize, standing } from './placement'
import { poseAt } from './pose-feed'
import type { Peer } from './presence'
import type { Scene } from './scene'

type Voice = { gain: GainNode; panner: PannerNode }
type Figure = { mesh: Mesh; material: MeshBasicMaterial; video: HTMLVideoElement | null; texture: VideoTexture | null; voice: Voice | null; pose: Pose }

export type Stage = {
  sync: (peers: readonly Peer[]) => void
  update: (camera: PerspectiveCamera, now: number) => void
  pick: (pointer: Vector2, camera: PerspectiveCamera) => string | null
  dispose: () => void
}

// A voice does not jump to its new loudness, or walking fast would click.
const SMOOTH_S = 0.08

function playing(stream: MediaStream): HTMLVideoElement {
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.autoplay = true
  video.playsInline = true
  playNow(video)
  return video
}

function voiceFor(context: AudioContext, stream: MediaStream): Voice {
  const gain = context.createGain()
  const panner = context.createPanner()
  panner.panningModel = 'HRTF'
  // Loudness is ours, from one tested curve: the panner only places the voice.
  panner.distanceModel = 'linear'
  panner.rolloffFactor = 0
  context.createMediaStreamSource(stream).connect(gain).connect(panner).connect(context.destination)
  return { gain, panner }
}

const place = (param: AudioParam | undefined, value: number, at: number) => param?.setValueAtTime(value, at)

function hear(voice: Voice, at: { x: number; y: number; z: number }, distance: number, range: Range, context: AudioContext) {
  const now = context.currentTime
  place(voice.panner.positionX, at.x, now)
  place(voice.panner.positionY, at.y, now)
  place(voice.panner.positionZ, at.z, now)
  voice.gain.gain.setTargetAtTime(gainFor(distance, range), now, SMOOTH_S)
}

function listen(context: AudioContext, camera: PerspectiveCamera) {
  const { position, forward, up } = listenerFrom(camera.position, camera.quaternion)
  const { listener } = context
  if (!listener.positionX) return listener.setPosition?.(...position)
  const now = context.currentTime
  for (const [param, value] of [[listener.positionX, position[0]], [listener.positionY, position[1]], [listener.positionZ, position[2]],
    [listener.forwardX, forward[0]], [listener.forwardY, forward[1]], [listener.forwardZ, forward[2]],
    [listener.upX, up[0]], [listener.upY, up[1]], [listener.upZ, up[2]]] as [AudioParam, number][]) param.setValueAtTime(value, now)
}

export function makeStage(world: Object3D, scene: Scene, context: AudioContext | null): Stage {
  const { height, width } = figureSize(scene)
  const geometry = new PlaneGeometry(width, height)
  const range = rangeFor(scene)
  const figures = new Map<string, Figure>()
  // Who is drawn, paired with what draws them, so the frame loop never looks anybody up.
  let drawn: { peer: Peer; figure: Figure }[] = []

  const add = (peer: Peer): Figure => {
    const material = new MeshBasicMaterial({ color: peer.member.color, transparent: true })
    const mesh = new Mesh(geometry, material)
    world.add(mesh)
    const figure: Figure = { mesh, material, video: null, texture: null, voice: null, pose: { x: 0, y: 0, z: 0, yaw: 0 } }
    figures.set(peer.member.id, figure)
    return figure
  }

  const show = (figure: Figure, stream: MediaStream) => {
    figure.video = playing(stream)
    figure.texture = new VideoTexture(figure.video)
    figure.material.map = figure.texture
    figure.material.color.set('#ffffff')
    figure.material.needsUpdate = true
    if (context) figure.voice = voiceFor(context, stream)
  }

  const remove = (id: string, figure: Figure) => {
    world.remove(figure.mesh)
    figure.material.dispose()
    figure.texture?.dispose()
    if (figure.video) figure.video.srcObject = null
    figure.voice?.panner.disconnect()
    figure.voice?.gain.disconnect()
    figures.delete(id)
  }

  return {
    sync(peers) {
      const here = new Set(peers.map((peer) => peer.member.id))
      for (const [id, figure] of [...figures]) if (!here.has(id)) remove(id, figure)
      drawn = peers.map((peer) => {
        const figure = figures.get(peer.member.id) ?? add(peer)
        if (peer.stream && !figure.video) show(figure, peer.stream)
        return { peer, figure }
      })
    },

    update(camera, now) {
      for (const { peer, figure } of drawn) {
        if (peer.motion) figure.pose = poseAt(peer.motion, now)
        const { x, y, z } = standing(figure.pose, scene)
        figure.mesh.position.set(x, y + height / 2, z)
        figure.mesh.rotation.set(0, billboardYaw({ x, z }, camera.position), 0)
        if (context && figure.voice) hear(figure.voice, figure.mesh.position, camera.position.distanceTo(figure.mesh.position), range, context)
      }
      if (context) listen(context, camera)
    },

    pick(pointer, camera) {
      const caster = new Raycaster()
      caster.setFromCamera(pointer, camera)
      const meshes = [...figures].map(([id, figure]) => ({ id, mesh: figure.mesh }))
      // A figure moved since the last frame is hit where it stands now, not where it was drawn.
      for (const { mesh } of meshes) mesh.updateMatrixWorld()
      const hit = caster.intersectObjects(meshes.map((one) => one.mesh), false)[0]
      return meshes.find((one) => one.mesh === hit?.object)?.id ?? null
    },

    dispose() {
      for (const [id, figure] of [...figures]) remove(id, figure)
      geometry.dispose()
    },
  }
}

/** Where this page's own person stands, for the others: its camera, flattened to a position and a facing. */
export function stanceOf(camera: PerspectiveCamera): Pose {
  const { x, y, z } = camera.position
  return { x, y, z, yaw: new Euler().setFromQuaternion(camera.quaternion, 'YXZ').y }
}

/** Where a pointer press falls on the view, as the raycaster wants it: −1 to 1 on each side. */
export const pointerAt = (event: { clientX: number; clientY: number }, box: DOMRect, into: Vector2): Vector2 =>
  into.set(((event.clientX - box.left) / box.width) * 2 - 1, -(((event.clientY - box.top) / box.height) * 2 - 1))
