import { execFileSync } from 'child_process'

export function hasSetuidPermission(permissions: string): boolean {
  return permissions.includes('s') || permissions.includes('S')
}

export function checkCorePermissionPathSync(corePath: string): boolean {
  if (process.platform === 'win32') return true
  try {
    const stdout = execFileSync('ls', ['-l', corePath], { encoding: 'utf8' })
    const permissions = stdout.trim().split(/\s+/)[0]
    return hasSetuidPermission(permissions)
  } catch {
    return false
  }
}
