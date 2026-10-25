// The hand reader: MediaPipe's landmarker over the camera stream the room already opened. The only file
// in the app that imports it, and the landmarker is a seam, so the rules above it are tested with no camera.
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { playNow } from './play'
import type { Hand } from './signs'

/** How often the hands are read. Measured against the scan's own frame cost: wiki/stack/hand-signs.md. */
export const EVERY_MS = 66

// Served from our own origin by scripts/roam-vendor-hands.mjs, so a demo needs no content delivery network.
const WASM = '/apps/roam/hands/wasm'
const MODEL = '/apps/roam/hands/hand_landmarker.task'

export type Landmarker = {
  detectForVideo: (video: HTMLVideoElement, at: number) => { landmarks: Hand[] }
  close: () => void
}
export type MakeLandmarker = () => Promise<Landmarker>

const mediapipe: MakeLandmarker = async () => {
  const files = await FilesetResolver.forVisionTasks(WASM)
  return await HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 2,
  })
}

export type HandReader = { stop: () => void }

/** Reads the hands in a stream until it is stopped. Throws if the landmarker will not start here. */
export async function readHands(stream: MediaStream, onHands: (hands: readonly Hand[], at: number) => void,
  make: MakeLandmarker = mediapipe): Promise<HandReader> {
  const landmarker = await make()
  const video = document.createElement('video')
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  playNow(video)
  const timer = setInterval(() => {
    const at = performance.now()
    onHands(landmarker.detectForVideo(video, at).landmarks, at)
  }, EVERY_MS)
  return {
    stop: () => {
      clearInterval(timer)
      landmarker.close()
      video.srcObject = null
    },
  }
}
