// The people inside the 3D world: a head, a torso and two hands each, their video on the face, their voice
// placed by where they stand. placement.ts and audio.ts own the numbers; this holds what the GPU needs.
import { BoxGeometry, Euler, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector3, VideoTexture, type Object3D, type PerspectiveCamera, type Vector2 } from 'three'
import { gainFor, listenerFrom, rangeFor, type Range } from './audio'
import type { Pose } from './messages'
import type { Note, NoteKind } from './notes'
import { playNow } from './play'
import { billboardYaw, facePlacement, figureSize, handSwing, rigParts, standing, type Rig } from './placement'
import { clamp01, poseAt } from './pose-feed'
import type { Peer } from './presence'
import type { Scene } from './scene'

type Voice = { gain: GainNode; panner: PannerNode }
type Body = { group: Group; head: Mesh; hands: [Mesh, Mesh]; face: Mesh; parts: Mesh[] }
type Figure = Body & {
  material: MeshBasicMaterial; faceMaterial: MeshBasicMaterial
  video: HTMLVideoElement | null; texture: VideoTexture | null; voice: Voice | null
  pose: Pose; walked: number; pace: number
}

/** What a press in the view landed on: somebody in the room, or something left in the place. */
export type Picked = { kind: 'peer' | 'note'; id: string }

export type Stage = {
  sync: (peers: readonly Peer[]) => void
  show: (notes: readonly Note[]) => void
  update: (camera: PerspectiveCamera, now: number) => void
  pick: (pointer: Vector2, camera: PerspectiveCamera) => Picked | null
  dispose: () => void
}

// A marker's colour says which kind of note it is, beside the shape everyone's figure already has.
const MARKED: Record<NoteKind, string> = { text: '#ffd166', voice: '#4fb8ff', photo: '#8bd450' }

// A voice does not jump to its new loudness, or walking fast would click.
const SMOOTH_S = 0.08

// How quickly a walking pace is followed. Long enough that one jumpy frame does not throw the hands.
const PACE_SMOOTH_MS = 200

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

/** One body, built from the shared shapes: the parts in their resting places, facing straight ahead. */
function bodyFrom(shapes: Shapes, rig: Rig, material: MeshBasicMaterial, faceMaterial: MeshBasicMaterial): Body {
  const group = new Group()
  const head = new Mesh(shapes.head, material)
  const torso = new Mesh(shapes.torso, material)
  const hands: [Mesh, Mesh] = [new Mesh(shapes.hand, material), new Mesh(shapes.hand, material)]
  const face = new Mesh(shapes.face, faceMaterial)
  head.position.set(...rig.head.at)
  torso.position.set(...rig.torso.at)
  const [side, up, forward] = rig.hand.at
  hands[0].position.set(-side, up, forward)
  hands[1].position.set(side, up, forward)
  face.position.set(0, rig.head.at[1], rig.face.radius)
  const parts = [head, torso, ...hands, face]
  // Named so a test can reach a part without counting children.
  for (const [part, name] of [[head, 'head'], [torso, 'torso'], [hands[0], 'left'], [hands[1], 'right'], [face, 'face']] as [Mesh, string][]) part.name = name
  group.add(...parts)
  return { group, head, hands, face, parts }
}

type Shapes = { head: BoxGeometry; torso: BoxGeometry; hand: BoxGeometry; face: PlaneGeometry; marker: PlaneGeometry }

export function makeStage(world: Object3D, scene: Scene, context: AudioContext | null): Stage {
  const { height } = figureSize(scene)
  const rig = rigParts(scene)
  const shapes: Shapes = {
    head: new BoxGeometry(...rig.head.size),
    torso: new BoxGeometry(...rig.torso.size),
    hand: new BoxGeometry(...rig.hand.size),
    face: new PlaneGeometry(rig.face.size, rig.face.size),
    marker: new PlaneGeometry(height * 0.2, height * 0.2),
  }
  const range = rangeFor(scene)
  const figures = new Map<string, Figure>()
  const markers = new Map<string, Mesh>()
  const spot = new Vector3()
  // Who is drawn, paired with what draws them, so the frame loop never looks anybody up.
  let drawn: { peer: Peer; figure: Figure }[] = []
  let last: number | null = null

  // How far a person has walked, and how fast. Read before the figure is moved, against where it still is.
  const travelled = (figure: Figure, x: number, z: number, elapsed: number) => {
    if (elapsed <= 0) return
    const step = Math.hypot(x - figure.group.position.x, z - figure.group.position.z)
    figure.walked += step
    figure.pace += (step / (elapsed / 1000) - figure.pace) * clamp01(elapsed / PACE_SMOOTH_MS)
  }

  const swing = (figure: Figure, now: number) => {
    const { left, right } = handSwing(figure.walked, figure.pace, now, height)
    const [side, up, forward] = rig.hand.at
    figure.hands[0].position.set(-side, up + left.y, forward + left.z)
    figure.hands[1].position.set(side, up + right.y, forward + right.z)
  }

  const add = (peer: Peer): Figure => {
    const material = new MeshBasicMaterial({ color: peer.member.color, transparent: true })
    const faceMaterial = new MeshBasicMaterial({ color: peer.member.color, transparent: true })
    const body = bodyFrom(shapes, rig, material, faceMaterial)
    world.add(body.group)
    const figure: Figure = { ...body, material, faceMaterial, video: null, texture: null, voice: null,
      pose: { x: 0, y: 0, z: 0, yaw: 0 }, walked: 0, pace: 0 }
    figures.set(peer.member.id, figure)
    return figure
  }

  const show = (figure: Figure, stream: MediaStream) => {
    figure.video = playing(stream)
    figure.texture = new VideoTexture(figure.video)
    figure.faceMaterial.map = figure.texture
    figure.faceMaterial.color.set('#ffffff')
    figure.faceMaterial.needsUpdate = true
    if (context) figure.voice = voiceFor(context, stream)
  }

  const mark = (note: Note): Mesh => {
    const mesh = new Mesh(shapes.marker, new MeshBasicMaterial({ color: MARKED[note.kind] }))
    mesh.position.set(note.spot.x, note.spot.y, note.spot.z)
    world.add(mesh)
    markers.set(note.id, mesh)
    return mesh
  }

  const unmark = (id: string, mesh: Mesh) => {
    world.remove(mesh)
    ;(mesh.material as MeshBasicMaterial).dispose()
    markers.delete(id)
  }

  const remove = (id: string, figure: Figure) => {
    world.remove(figure.group)
    figure.material.dispose()
    figure.faceMaterial.dispose()
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

    show(notes) {
      const here = new Set(notes.map((note) => note.id))
      for (const [id, mesh] of [...markers]) if (!here.has(id)) unmark(id, mesh)
      for (const note of notes) if (!markers.has(note.id)) mark(note)
    },

    update(camera, now) {
      const elapsed = last === null ? 0 : Math.max(0, now - last)
      last = now
      for (const { peer, figure } of drawn) {
        if (peer.motion) figure.pose = poseAt(peer.motion, now)
        const { x, y, z } = standing(figure.pose, scene)
        travelled(figure, x, z, elapsed)
        figure.group.position.set(x, y, z)
        figure.group.rotation.set(0, figure.pose.yaw, 0)
        const turned = facePlacement(figure.pose.yaw, billboardYaw({ x, z }, camera.position), rig.face.radius)
        figure.face.position.set(turned.x, rig.head.at[1], turned.z)
        figure.face.rotation.set(0, turned.yaw, 0)
        swing(figure, now)
        // The head sits on the group's own line, so its place in the world needs no matrix.
        spot.set(x, y + rig.head.at[1], z)
        if (context && figure.voice) hear(figure.voice, spot, camera.position.distanceTo(spot), range, context)
      }
      // A marker stays where it was left and turns to face whoever is looking, as a figure does.
      for (const mesh of markers.values()) {
        mesh.rotation.set(0, billboardYaw({ x: mesh.position.x, z: mesh.position.z }, camera.position), 0)
      }
      if (context) listen(context, camera)
    },

    pick(pointer, camera) {
      const caster = new Raycaster()
      caster.setFromCamera(pointer, camera)
      const meshes = [...[...figures].flatMap(([id, figure]) => figure.parts.map((mesh) => ({ kind: 'peer' as const, id, mesh }))),
        ...[...markers].map(([id, mesh]) => ({ kind: 'note' as const, id, mesh }))]
      // A press can land between frames, and a raycast reads the world matrix the last frame left behind.
      for (const one of meshes) one.mesh.updateWorldMatrix(true, false)
      const hit = caster.intersectObjects(meshes.map((one) => one.mesh), false)[0]
      const found = meshes.find((one) => one.mesh === hit?.object)
      return found ? { kind: found.kind, id: found.id } : null
    },

    dispose() {
      for (const [id, figure] of [...figures]) remove(id, figure)
      for (const [id, mesh] of [...markers]) unmark(id, mesh)
      for (const shape of Object.values(shapes)) shape.dispose()
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
