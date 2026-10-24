import { poseFor, type Pose, type Scene, type View } from './scene'

export type ViewerState =
  | { status: 'loading'; progress: number | null }
  | { status: 'ready'; scene: Scene; camera: number; pose: Pose }
  | { status: 'error'; message: string }
  | { status: 'no-webgl' }

export type ViewerEvent =
  | { type: 'progress'; progress: number }
  | { type: 'ready'; scene: Scene }
  | { type: 'error'; message: string }
  | { type: 'no-webgl' }
  | { type: 'go'; view: View }
  | { type: 'retry' }

export const initialViewer: ViewerState = { status: 'loading', progress: null }

/** The viewer's state. Each jump makes a new pose, so pressing the same view again moves the camera back there. */
export function viewerReducer(state: ViewerState, event: ViewerEvent): ViewerState {
  switch (event.type) {
    case 'progress':
      return state.status === 'loading' ? { status: 'loading', progress: event.progress } : state
    case 'ready':
      return { status: 'ready', scene: event.scene, camera: 0, pose: poseFor(event.scene, 'room') }
    case 'go': {
      if (state.status !== 'ready') return state
      const camera = typeof event.view === 'number' ? event.view : event.view === 'room' ? 0 : state.camera
      return { ...state, camera, pose: poseFor(state.scene, event.view) }
    }
    case 'error':
      return { status: 'error', message: event.message }
    case 'no-webgl':
      return { status: 'no-webgl' }
    case 'retry':
      return initialViewer
  }
}
