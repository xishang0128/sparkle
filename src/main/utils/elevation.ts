import { execFile } from 'child_process'
import { promisify } from 'util'

const execFilePromise = promisify(execFile)

let isAdminCached: boolean | null = null

async function isRunningAsAdmin(): Promise<boolean> {
  if (isAdminCached !== null) {
    return isAdminCached
  }

  try {
    await execFilePromise('net', ['session'], { timeout: 2000 })
    isAdminCached = true
    return true
  } catch {
    isAdminCached = false
    return false
  }
}

export async function execWithElevation(command: string, args: string[]): Promise<void> {
  if (process.platform === 'win32') {
    try {
      if (await isRunningAsAdmin()) {
        await execFilePromise(command, args, { timeout: 30000 })
      } else {
        const psArgs = args
          .map((arg) => {
            const escaped = arg.replace(/'/g, "''")
            return `'${escaped}'`
          })
          .join(',')
        await execFilePromise(
          'powershell.exe',
          [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            `& { $p = Start-Process -FilePath '${command}' -ArgumentList @(${psArgs}) -Verb RunAs -WindowStyle Hidden -PassThru -Wait; exit $p.ExitCode }`
          ],
          { timeout: 30000 }
        )
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
