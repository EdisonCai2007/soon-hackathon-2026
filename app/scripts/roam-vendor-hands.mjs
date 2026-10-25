import { cp, mkdir, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The hand reader's WebAssembly, served from our own origin so a demo needs no CDN. It comes from the
// pinned package rather than git: each file is over 12 MB. The model beside it is committed, like the scan.
const here = dirname(fileURLToPath(import.meta.url))
const from = join(here, '..', 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const to = join(here, '..', 'public', 'apps', 'roam', 'hands', 'wasm')

const missing = await stat(from).then(() => null, () => from)
if (missing) {
  console.error(`roam-vendor-hands: ${missing} is not there. Run npm install first.`)
  process.exit(1)
}
await mkdir(to, { recursive: true })
await cp(from, to, { recursive: true })
console.log(`roam-vendor-hands: copied the hand reader's WebAssembly to ${to}`)
