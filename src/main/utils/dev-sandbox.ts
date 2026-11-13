import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import type { DevSandbox } from '../../../scripts/dev-sandbox'

// Production builds cannot be opted into a sandbox through environment variables.
export const devSandbox: DevSandbox | undefined =
  import.meta.env.DEV && !app.isPackaged && process.env.SPARKLE_DEV_SANDBOX
    ? JSON.parse(process.env.SPARKLE_DEV_SANDBOX)
    : undefined

if (devSandbox) {
  writeFileSync(path.join(devSandbox.directory, 'electron.pid'), String(process.pid))
  app.setPath('userData', devSandbox.userData)
  const sessionData = path.join(devSandbox.userData, 'session')
  mkdirSync(sessionData, { recursive: true })
  app.setPath('sessionData', sessionData)
  app.setPath('logs', path.join(devSandbox.userData, 'logs'))
  app.setName(`Sparkle Sandbox ${devSandbox.id}`)
}

export function assertOutsideDevSandbox(): void {
  if (devSandbox) throw new Error('开发沙盒禁用会影响系统或其他实例的操作')
}

export function sandboxMihomoConfig<T extends Partial<MihomoConfig>>(config: T): T {
  if (!devSandbox) return config
  return {
    ...config,
    'mixed-port': devSandbox.ports.mixed,
    port: 0,
    'socks-port': 0,
    'redir-port': 0,
    'tproxy-port': 0,
    'external-controller': '',
    'external-controller-tls': '',
    'external-controller-unix': undefined,
    'external-controller-pipe': undefined,
    'allow-lan': false,
    'bind-address': '127.0.0.1',
    tun: { ...config.tun, enable: false },
    dns: { ...config.dns, listen: `127.0.0.1:${devSandbox.ports.dns}` },
    listeners: []
  }
}
