import axios from 'axios'
import { app } from 'electron'
import { fileToDataUrl } from '@uruhalushia/file-icon'
import { getControledMihomoConfig } from '../config'
import { darwinDefaultIcon, otherDevicesIcon, windowsDefaultIcon } from './defaultIcon'

function getDefaultIconDataURL(): string {
  if (process.platform === 'win32') {
    return windowsDefaultIcon
  }
  if (process.platform === 'darwin' || process.platform === 'linux') {
    return darwinDefaultIcon
  }
  return ''
}

export async function getIconDataURL(appPath: string): Promise<string> {
  if (!appPath) {
    return otherDevicesIcon
  }
  if (appPath === 'mihomo') {
    appPath = app.getPath('exe')
  }

  try {
    return fileToDataUrl(appPath)
  } catch {
    return getDefaultIconDataURL()
  }
}

export async function getImageDataURL(url: string): Promise<string> {
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    ...(port != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port
      }
    })
  })
  const mimeType = res.headers['content-type']
  const dataURL = `data:${mimeType};base64,${Buffer.from(res.data).toString('base64')}`
  return dataURL
}
