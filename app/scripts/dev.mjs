import { spawn } from 'node:child_process'

// `npm run dev` on Windows runs through cmd.exe, which reads `CLOUDFLARE_ENV=local vite` as a program called
// CLOUDFLARE_ENV. Setting the value here and starting Vite from Node works the same in every shell.
const vite = spawn('npx', ['vite', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, CLOUDFLARE_ENV: 'local' },
})
vite.on('exit', (code) => process.exit(code ?? 1))
