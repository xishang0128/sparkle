import { execFile } from 'child_process'
import { promisify } from 'util'
import { mihomoCorePath } from '../utils/dirs'
import { checkCorePermissionPathSync, hasSetuidPermission } from './permission-check'
import { createElevateTask } from '../sys/misc'

type CoreName = 'mihomo' | 'mihomo-alpha'

class UserCancelledError extends Error {
  constructor(message = '用户取消操作') {
    super(message)
    this.name = 'UserCancelledError'
  }
}

function isUserCancelledError(error: unknown): boolean {
  if (error instanceof UserCancelledError) {
    return true
  }
  const errorMsg = error instanceof Error ? error.message : String(error)
  return (
    errorMsg.includes('用户已取消') ||
    errorMsg.includes('User canceled') ||
    errorMsg.includes('(-128)') ||
    errorMsg.includes('user cancelled') ||
    errorMsg.includes('dismissed')
  )
}

export async function manualGrantCorePermition(cores?: CoreName[]): Promise<void> {
  if (process.platform === 'win32') {
    try {
      await createElevateTask()
    } catch (error) {
      if (isUserCancelledError(error)) {
        throw new UserCancelledError()
      }
      throw error
    }
    return
  }

  const execFilePromise = promisify(execFile)

  const grantPermission = async (coreName: CoreName): Promise<void> => {
    const corePath = mihomoCorePath(coreName)
    try {
      if (process.platform === 'darwin') {
        const escapedPath = corePath.replace(/"/g, '\\"')
        const shell = `chown root:admin \\"${escapedPath}\\" && chmod +sx \\"${escapedPath}\\"`
        const command = `do shell script "${shell}" with administrator privileges`
        await execFilePromise('osascript', ['-e', command])
      }
      if (process.platform === 'linux') {
        await execFilePromise('pkexec', [
          'bash',
          '-c',
          `chown root:root "${corePath}" && chmod +sx "${corePath}"`
        ])
      }
    } catch (error) {
      if (isUserCancelledError(error)) {
        throw new UserCancelledError()
      }
      throw error
    }
  }

  const targetCores = cores || ['mihomo', 'mihomo-alpha']
  await Promise.all(targetCores.map((core) => grantPermission(core)))
}

export function checkCorePermissionSync(coreName: CoreName): boolean {
  return checkCorePermissionPathSync(mihomoCorePath(coreName))
}

export async function checkCorePermission(): Promise<{ mihomo: boolean; 'mihomo-alpha': boolean }> {
  const execFilePromise = promisify(execFile)

  const checkPermission = async (coreName: CoreName): Promise<boolean> => {
    try {
      const corePath = mihomoCorePath(coreName)
      const { stdout } = await execFilePromise('ls', ['-l', corePath])
      const permissions = stdout.trim().split(/\s+/)[0]
      return hasSetuidPermission(permissions)
    } catch (error) {
      return false
    }
  }

  const [mihomoPermission, mihomoAlphaPermission] = await Promise.all([
    checkPermission('mihomo'),
    checkPermission('mihomo-alpha')
  ])

  return {
    mihomo: mihomoPermission,
    'mihomo-alpha': mihomoAlphaPermission
  }
}

export async function revokeCorePermission(cores?: CoreName[]): Promise<void> {
  const execFilePromise = promisify(execFile)

  const revokePermission = async (coreName: CoreName): Promise<void> => {
    const corePath = mihomoCorePath(coreName)
    try {
      if (process.platform === 'darwin') {
        const escapedPath = corePath.replace(/"/g, '\\"')
        const shell = `chmod a-s \\"${escapedPath}\\"`
        const command = `do shell script "${shell}" with administrator privileges`
        await execFilePromise('osascript', ['-e', command])
      }
      if (process.platform === 'linux') {
        await execFilePromise('pkexec', ['bash', '-c', `chmod a-s "${corePath}"`])
      }
    } catch (error) {
      if (isUserCancelledError(error)) {
        throw new UserCancelledError()
      }
      throw error
    }
  }

  const targetCores = cores || ['mihomo', 'mihomo-alpha']
  await Promise.all(targetCores.map((core) => revokePermission(core)))
}
