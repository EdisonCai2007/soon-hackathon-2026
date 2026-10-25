/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

// The two faults that kept the app from starting on a Windows machine, kept from coming back. Neither can fail
// CI, which runs on Linux and never starts the dev server, so the suite has to notice them instead.
const app = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (file: string) => readFileSync(join(app, file), 'utf8')

it('writes no package script that sets a shell variable inline, which cmd.exe reads as a program', () => {
  const { scripts } = JSON.parse(read('package.json')) as { scripts: Record<string, string> }
  const inline = Object.entries(scripts).filter(([, command]) => /^\s*[A-Z_][A-Z0-9_]*=/.test(command))
  expect(inline, 'set the value from a Node runner instead, as scripts/dev.mjs does').toEqual([])
})

it('lets the dev server reach the repo root, where the Worker reads the setup script from', () => {
  const config = read('vite.config.ts')
  expect(config).toMatch(/server:\s*\{\s*fs:\s*\{\s*allow:/)
  expect(config).toContain("new URL('..', import.meta.url)")
})
