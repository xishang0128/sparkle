import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import axios from 'axios'
import type { DevSandbox } from './dev-sandbox.ts'

interface Instance {
  child: ChildProcess
  output: () => string
  sandbox: DevSandbox | undefined
}
const instances: Instance[] = []
function launch(): Instance {
  const child = spawn(process.execPath, ['scripts/dev.ts'], { stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk
  })
  child.stderr.on('data', (chunk) => {
    output += chunk
  })
  const instance = { child, output: () => output, sandbox: undefined as DevSandbox | undefined }
  instances.push(instance)
  return instance
}
async function waitFor(check: () => Promise<boolean>, message: string, timeout = 60_000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      if (await check()) return
    } catch {
      /* Startup/shutdown is still in progress. */
    }
    await delay(200)
  }
  throw new Error(message)
}
async function ready(instance: ReturnType<typeof launch>) {
  await waitFor(async () => {
    const directory = instance.output().match(/\[sandbox\] data: (.+)/)?.[1]
    if (!directory) return false
    instance.sandbox = JSON.parse(await readFile(path.join(directory, '../sandbox.json'), 'utf8'))
    const response = await api(instance.sandbox!).get('/configs')
    return response.status === 200
  }, 'Sandbox did not start')
  return instance.sandbox!
}
function api(sandbox: DevSandbox) {
  return axios.create({
    socketPath: sandbox.socket,
    baseURL: 'http://localhost',
    proxy: false,
    timeout: 1000
  })
}
async function isListening(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(port, '127.0.0.1')
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
  })
}
async function stop(instance: ReturnType<typeof launch>) {
  instance.child.kill('SIGTERM')
  await waitFor(
    async () => instance.child.exitCode !== null || instance.child.signalCode !== null,
    'Launcher did not exit',
    15_000
  )
  if (instance.sandbox) {
    const sandbox = instance.sandbox
    const electronPid = Number(await readFile(path.join(sandbox.directory, 'electron.pid'), 'utf8'))
    await waitFor(
      async () => {
        try {
          process.kill(electronPid, 0)
          return false
        } catch (error) {
          return (error as NodeJS.ErrnoException).code === 'ESRCH'
        }
      },
      'Electron did not exit',
      15_000
    )
    await waitFor(
      async () => !(await Promise.all(Object.values(sandbox.ports).map(isListening))).some(Boolean),
      'Sandbox left listening child processes',
      15_000
    )
  }
}

const target = http.createServer((_request, response) => response.end('sandbox-proxy-ok'))
try {
  await new Promise<void>((resolve) => {
    target.listen(0, '127.0.0.1', resolve)
  })
  const targetPort = (target.address() as net.AddressInfo).port
  const first = launch()
  const second = launch()
  const [a, b] = await Promise.all([ready(first), ready(second)])
  assert.notEqual(a.userData, b.userData)
  assert.notEqual(a.outDir, b.outDir)
  assert.notEqual(a.socket, b.socket)
  assert.equal(new Set([...Object.values(a.ports), ...Object.values(b.ports)]).size, 12)
  for (const sandbox of [a, b]) {
    const { data } = await api(sandbox).get('/configs')
    assert.equal(data['mixed-port'], sandbox.ports.mixed)
    assert.equal(data.tun.enable, false)
    const proxied = await axios.get(`http://127.0.0.1:${targetPort}/`, {
      proxy: { host: '127.0.0.1', port: sandbox.ports.mixed, protocol: 'http' },
      timeout: 3000
    })
    assert.equal(proxied.data, 'sandbox-proxy-ok')
    for (const port of [sandbox.ports.renderer, sandbox.ports.substore, sandbox.ports.frontend]) {
      assert.ok(await isListening(port))
    }
  }
  const untouched = await readFile(path.join(b.userData, 'config.yaml'), 'utf8')
  await writeFile(
    path.join(a.userData, 'config.yaml'),
    (await readFile(path.join(a.userData, 'config.yaml'), 'utf8')).replace(
      'appTheme: system',
      'appTheme: dark'
    )
  )
  assert.equal(await readFile(path.join(b.userData, 'config.yaml'), 'utf8'), untouched)
  await api(a).patch('/configs', { mode: 'direct' })
  assert.equal((await api(a).get('/configs')).data.mode, 'direct')
  assert.equal((await api(b).get('/configs')).data.mode, 'rule')
  console.log(
    'PASS: concurrent instances, independent files/builds/sockets/ports, both proxies work, config changes isolated'
  )
  await stop(first)
  assert.equal((await api(b).get('/configs')).data.mode, 'rule')
  assert.ok(await isListening(b.ports.renderer))
  console.log('PASS: closing one instance releases its ports and leaves the other running')
} catch (error) {
  for (const instance of instances) console.error(instance.output())
  throw error
} finally {
  await Promise.all(instances.map(stop))
  target.close()
}
