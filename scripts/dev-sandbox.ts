import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  openSync,
  closeSync,
  cpSync,
  chmodSync,
  readdirSync
} from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import dgram from 'node:dgram'

export async function createDevSandbox(root: string) {
  const base = path.join(root, '.dev-sandboxes')
  mkdirSync(base, { recursive: true })
  const directory = mkdtempSync(path.join(base, 'instance-'))
  const id = path.basename(directory)
  const locks = path.join(os.tmpdir(), 'sparkle-dev-ports')
  mkdirSync(locks, { recursive: true })
  const ownedLocks: string[] = []
  const release = () => {
    for (const file of ownedLocks) rmSync(file, { force: true })
  }
  const port = async (): Promise<number> => {
    for (;;) {
      const server = net.createServer()
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(0, '127.0.0.1', resolve)
      })
      const value = (server.address() as net.AddressInfo).port
      const lock = path.join(locks, String(value))
      let acquired = false
      const udp = dgram.createSocket('udp4')
      try {
        await new Promise<void>((resolve, reject) => {
          udp.once('error', reject)
          udp.bind(value, '127.0.0.1', resolve)
        })
        closeSync(openSync(lock, 'wx'))
        ownedLocks.push(lock)
        acquired = true
      } catch (error) {
        if (!['EEXIST', 'EADDRINUSE'].includes((error as NodeJS.ErrnoException).code || ''))
          throw error
      } finally {
        try {
          udp.close()
        } catch {
          /* A failed bind has no socket to close. */
        }
        await new Promise<void>((resolve) => {
          server.close(() => resolve())
        })
      }
      if (acquired) return value
    }
  }
  try {
    const sandbox = {
      id,
      directory,
      resources: path.join(root, 'extra'),
      userData: path.join(directory, 'data'),
      outDir: path.join(directory, 'out'),
      socket:
        process.platform === 'win32'
          ? `\\\\.\\pipe\\sparkle-dev-${id}`
          : path.join('/tmp', `sparkle-dev-${id}.sock`),
      ports: {
        mixed: await port(),
        dns: await port(),
        renderer: await port(),
        substore: await port(),
        frontend: await port(),
        pac: await port()
      }
    }
    const sidecar = path.join(directory, 'sidecar')
    cpSync(path.join(root, 'extra/sidecar'), sidecar, { recursive: true })
    for (const file of readdirSync(sidecar)) chmodSync(path.join(sidecar, file), 0o755)
    mkdirSync(sandbox.userData, { recursive: true })
    writeFileSync(path.join(directory, 'sandbox.json'), JSON.stringify(sandbox, null, 2))
    return { sandbox, release }
  } catch (error) {
    release()
    throw error
  }
}

export type DevSandbox = Awaited<ReturnType<typeof createDevSandbox>>['sandbox']
