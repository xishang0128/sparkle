import koffi from 'koffi'
import path from 'path'

type DosDeviceMapping = {
  drive: string
  devicePath: string
}

const DOS_DEVICE_BUFFER_CHARS = 4096
const DRIVE_LETTERS = Array.from({ length: 26 }, (_, i) => `${String.fromCharCode(65 + i)}:`)
const kernel32 = koffi.load('kernel32.dll')
const QueryDosDeviceW = kernel32.func(
  'uint32 __stdcall QueryDosDeviceW(const char16_t *lpDeviceName, _Out_ void *lpTargetPath, uint32 ucchMax)'
)

function queryDosDevice(deviceName: string): string | null {
  const buffer = Buffer.alloc(DOS_DEVICE_BUFFER_CHARS * 2)
  const length = QueryDosDeviceW(deviceName, buffer, DOS_DEVICE_BUFFER_CHARS)
  if (!length) {
    return null
  }

  return buffer.toString('utf16le', 0, length * 2).split('\u0000')[0] || null
}

export function resolveWithDosDeviceMappings(targetPath: string): string | null {
  const normalizedInput = path.win32.normalize(targetPath)

  for (const { drive, devicePath } of DRIVE_LETTERS.map((drive) => ({
    drive,
    devicePath: queryDosDevice(drive)
  })).filter((mapping): mapping is DosDeviceMapping => mapping.devicePath !== null)) {
    const normalizedDevicePath = path.win32.normalize(devicePath)
    if (normalizedInput === normalizedDevicePath) {
      return `${drive}\\`
    }

    if (normalizedInput.startsWith(`${normalizedDevicePath}\\`)) {
      const rest = normalizedInput.slice(normalizedDevicePath.length).replace(/^\\+/, '')
      return path.win32.normalize(`${drive}\\${rest}`)
    }
  }

  return null
}
