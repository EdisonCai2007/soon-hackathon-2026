// The phone's own recorder and camera, wrapped thinly: everything here needs a real phone, so the screens stay
// testable and the numbers live beside the rules. wiki/development/ar-in-the-browser.md
export type Recording = { stop: () => Promise<Blob | null> }

/** The longest clip a note carries. Beyond this the recorder stops itself. */
export const CLIP_MS = 15_000
/** The longest side a photograph is kept at, which puts a phone's picture inside the note's own cap. */
export const PHOTO_SIDE = 1280

/** Starts recording the microphone, which an AR session allows. Null where the phone refuses. */
export async function recordVoice(limitMs = CLIP_MS): Promise<Recording | null> {
  let stream: MediaStream
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
  catch { return null }
  let recorder: MediaRecorder
  try { recorder = new MediaRecorder(stream) }
  catch {
    for (const track of stream.getTracks()) track.stop()
    return null
  }
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => chunks.push(event.data)
  const done = new Promise<Blob | null>((settle) => {
    recorder.onstop = () => {
      for (const track of stream.getTracks()) track.stop()
      settle(chunks.length === 0 ? null : new Blob(chunks, { type: recorder.mimeType }))
    }
  })
  recorder.start()
  const timer = setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, limitMs)
  return {
    stop: () => {
      clearTimeout(timer)
      if (recorder.state !== 'inactive') recorder.stop()
      return done
    },
  }
}

/** The size a picture is kept at: its own, or scaled down until its longest side fits. */
export function fitWithin(width: number, height: number, side: number): { width: number; height: number } {
  const scale = Math.min(1, side / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** A photograph the system camera took, shrunk to fit a note. Null where the browser cannot read it. */
export async function shrinkPhoto(file: Blob, side = PHOTO_SIDE): Promise<Blob | null> {
  try {
    const picture = await createImageBitmap(file)
    const { width, height } = fitWithin(picture.width, picture.height, side)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const paper = canvas.getContext('2d')
    if (!paper) return null
    paper.drawImage(picture, 0, 0, width, height)
    picture.close?.()
    return await new Promise<Blob | null>((settle) => canvas.toBlob((blob) => settle(blob), 'image/jpeg', 0.7))
  } catch { return null }
}
