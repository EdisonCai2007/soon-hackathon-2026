// Loading the scan, in one place: the laptop's viewer and the phone's AR view both want it stood upright and put
// where the scene's details say, so the two cannot drift apart. openspec roam-ar-view, "One way to load a scan".
import { SplatMesh, type SplatMeshOptions } from '@sparkjsdev/spark'
import { displayQuaternion, type Scene } from './scene'

/** The scan as one mesh, upright and in place. Extra options go straight to the mesh, which is how a phone asks
 *  for a level of detail and a budget where the laptop asks for neither. */
export function loadSplats(scene: Scene, options: SplatMeshOptions): SplatMesh {
  const splats = new SplatMesh(options)
  splats.quaternion.copy(displayQuaternion(scene))
  splats.position.fromArray(scene.translation)
  return splats
}
