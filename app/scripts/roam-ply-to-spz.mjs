import { readFile, writeFile } from 'node:fs/promises'
import { transcodeSpz } from '@sparkjsdev/spark'

// One-off: node scripts/roam-ply-to-spz.mjs <in.ply> <out.spz>. Keeps spherical harmonics (degree 3).
const [input, output] = process.argv.slice(2)
const fileBytes = new Uint8Array(await readFile(input))
const { fileBytes: spz } = await transcodeSpz({ inputs: [{ fileBytes, pathOrUrl: input }], maxSh: 3 })
await writeFile(output, spz)
console.log(`${input} (${fileBytes.length} B) -> ${output} (${spz.length} B)`)
