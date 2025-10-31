import { getAppConfig, getControledMihomoConfig } from '../config'
import { pacPort, startPacServer, stopPacServer } from '../resolve/server'
import { promisify } from 'util'
import { execFile } from 'child_process'
import { servicePath } from '../utils/dirs'
import { net } from 'electron'
import { disableProxy, setPac, setProxy } from '../service/api'

let defaultBypass: string[]
let triggerSysProxyTimer: NodeJS.Timeout | null = null

export async function triggerSysProxy(enable: boolean, onlyActiveDevice: boolean): Promise<void> {
  if (net.isOnline()) {
    if (enable) {
      await setSysProxy(onlyActiveDevice)
    } else {
      await disableSysProxy(onlyActiveDevice)
    }
  } else {
    if (triggerSysProxyTimer) clearTimeout(triggerSysProxyTimer)
    triggerSysProxyTimer = setTimeout(() => triggerSysProxy(enable, onlyActiveDevice), 5000)
  }
}

async function setSysProxy(onlyActiveDevice: boolean): Promise<void> {
  if (process.platform === 'linux')
    defaultBypass = [
      'localhost',
      '.local',
      '127.0.0.1/8',
      '192.168.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '::1'
    ]
  if (process.platform === 'darwin')
    defaultBypass = [
      '127.0.0.1/8',
      '192.168.0.0/16',
      '10.0.0.0/8',
      '172.16.0.0/12',
      'localhost',
      '*.local',
      '*.crashlytics.com',
      '<local>'
    ]
  if (process.platform === 'win32')
    defaultBypass = [
      'localhost',
      '127.*',
      '192.168.*',
      '10.*',
      '172.16.*',
      '172.17.*',
      '172.18.*',
      '172.19.*',
      '172.20.*',
      '172.21.*',
      '172.22.*',
      '172.23.*',
      '172.24.*',
      '172.25.*',
      '172.26.*',
      '172.27.*',
      '172.28.*',
      '172.29.*',
      '172.30.*',
      '172.31.*',
      '<local>'
    ]
  await startPacServer()
  const { sysProxy } = await getAppConfig()
  const { mode, host, bypass = defaultBypass, settingMode = 'exec' } = sysProxy
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  const execFilePromise = promisify(execFile)
  const useService = process.platform === 'darwin' && settingMode === 'service'

  switch (mode || 'manual') {
    case 'auto': {
      if (useService) {
        try {
          await setPac(`http://${host || '127.0.0.1'}:${pacPort}/pac`, '', onlyActiveDevice)
        } catch {
          throw new Error('服务可能未安装')
        }
      } else {
        await execFilePromise(servicePath(), [
          'pac',
          '--url',
          `http://${host || '127.0.0.1'}:${pacPort}/pac`
        ])
      }
      break
    }

    case 'manual': {
      if (port != 0) {
        if (useService) {
          try {
            await setProxy(`${host || '127.0.0.1'}:${port}`, bypass.join(','), '', onlyActiveDevice)
          } catch {
            throw new Error('服务可能未安装')
          }
        } else {
          await execFilePromise(servicePath(), [
            'proxy',
            '--server',
            `${host || '127.0.0.1'}:${port}`,
            '--bypass',
            process.platform === 'win32' ? bypass.join(';') : bypass.join(',')
          ])
        }
      }
      break
    }
  }
}

export async function disableSysProxy(onlyActiveDevice: boolean): Promise<void> {
  await stopPacServer()
  const { sysProxy } = await getAppConfig()
  const { settingMode = 'exec' } = sysProxy
  const execFilePromise = promisify(execFile)
  const useService = process.platform === 'darwin' && settingMode === 'service'

  if (useService) {
    try {
      await disableProxy('', onlyActiveDevice)
    } catch (e) {
      throw new Error('服务可能未安装')
    }
  } else {
    await execFilePromise(servicePath(), ['disable'])
  }
}
