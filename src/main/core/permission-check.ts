import { statSync } from 'fs'

const S_ISUID = 0o4000

export function hasSetuidPermission(permissions: string): boolean {
  return permissions.includes('s') || permissions.includes('S')
}

export function checkCorePermissionPathSync(corePath: string): boolean {
  if (process.platform === 'win32') return true
  try {
    return (statSync(corePath).mode & S_ISUID) !== 0
  } catch {
    return false
  }
}
