import { execFile } from 'child_process'
import { promisify } from 'util'

const execFilePromise = promisify(execFile)

export async function execWithElevation(command: string, args: string[]): Promise<void> {
  if (process.platform === 'win32') {
    const cmd = `"${command}" ${args.join(' ')}`
    try {
      const result = await execFilePromise('powershell', [
        '-NoProfile',
        '-Command',
        `Start-Process -FilePath powershell -ArgumentList '-NoProfile -Command "& ${cmd}"' -Verb RunAs -WindowStyle Hidden -Wait -PassThru | Out-Null`
      ])
      if (result.stderr) {
        throw new Error(result.stderr)
      }
    } catch (error) {
      throw new Error(
        `Windows 提权执行失败：${error instanceof Error ? error.message : String(error)}`
      )
    }
  } else if (process.platform === 'linux') {
    try {
      await execFilePromise('pkexec', [command, ...args])
    } catch (error) {
      throw new Error(
        `Linux 提权执行失败：${error instanceof Error ? error.message : String(error)}`
      )
    }
  } else if (process.platform === 'darwin') {
    const cmd = `${command} ${args.join(' ')}`
    try {
      await execFilePromise('osascript', [
        '-e',
        `do shell script "${cmd}" with administrator privileges`
      ])
    } catch (error) {
      throw new Error(
        `macOS 提权执行失败：${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
