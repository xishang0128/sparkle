import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import { createDevSandbox } from './dev-sandbox.ts'

const require = createRequire(import.meta.url)
const { sandbox, release } = await createDevSandbox(process.cwd())
console.log(
  `[sandbox] ${sandbox.id}\n[sandbox] data: ${sandbox.userData}\n[sandbox] ports: ${JSON.stringify(sandbox.ports)}`
)
const cli = path.join(
  path.dirname(require.resolve('electron-vite/package.json')),
  'bin/electron-vite.js'
)
const child = spawn(
  process.execPath,
  [
    cli,
    'dev',
    ...process.argv.slice(2),
    '--outDir',
    sandbox.outDir,
    '--entry',
    path.join(sandbox.outDir, 'main/index.js')
  ],
  {
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: { ...process.env, SPARKLE_DEV_SANDBOX: JSON.stringify(sandbox) }
  }
)
function stopChildren(): void {
  if (!child.pid) return
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      process.kill(-child.pid, 'SIGTERM')
    }
  } catch {
    // The process group may already have exited.
  }
}
process.on('exit', () => {
  stopChildren()
  release()
})
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, stopChildren)
}
child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 0
})
