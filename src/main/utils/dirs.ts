import { is } from '@electron-toolkit/utils'
import { constants, existsSync, mkdirSync, type BigIntStats } from 'fs'
import { access, copyFile, mkdtemp, readFile, readdir, rm, stat } from 'fs/promises'
import { app } from 'electron'
import path from 'path'
import { tmpdir } from 'os'
import { execFile, type ExecException } from 'child_process'
import { promisify, stripVTControlCharacters } from 'util'
import { getAppConfigSync } from '../config/app'
import { checkCorePermissionPathSync } from '../core/permission-check'
import {
  systemCoreDefaultPath,
  systemCoreOnlyBuild,
  systemServicePath
} from '../../shared/build-flags'

export const homeDir = app.getPath('home')

export function isPortable(): boolean {
  return existsSync(path.join(exeDir(), 'PORTABLE'))
}

export function dataDir(): string {
  if (isPortable()) {
    return path.join(exeDir(), 'data')
  } else {
    return app.getPath('userData')
  }
}

export function taskDir(): string {
  const dir = path.join(app.getPath('userData'), 'tasks')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function subStoreDir(): string {
  return path.join(dataDir(), 'substore')
}

export function subStoreFrontendDir(): string {
  return path.join(subStoreDir(), 'sub-store-frontend')
}

export function subStoreBackendPath(): string {
  return path.join(subStoreDir(), 'sub-store.bundle.js')
}

export function subStoreTempDir(): string {
  return path.join(subStoreDir(), 'temp')
}

export function exeDir(): string {
  return path.dirname(exePath())
}

export function exePath(): string {
  return app.getPath('exe')
}

export function resourcesDir(): string {
  if (is.dev) {
    return path.join(__dirname, '../../extra')
  } else {
    if (app.getAppPath().endsWith('asar')) {
      return process.resourcesPath
    } else {
      return path.join(app.getAppPath(), 'resources')
    }
  }
}

export function resourcesFilesDir(): string {
  return path.join(resourcesDir(), 'files')
}

export function themesDir(): string {
  return path.join(dataDir(), 'themes')
}

export function mihomoIpcPath(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\Sparkle\\mihomo'
  }
  const { core = 'mihomo' } = getAppConfigSync()
  if (core === 'system') {
    return '/tmp/sparkle-mihomo-external.sock'
  }
  if (!checkCorePermissionPathSync(mihomoCorePath(core))) {
    return '/tmp/sparkle-mihomo-api-noperm.sock'
  }
  return '/tmp/sparkle-mihomo-api.sock'
}

export function serviceIpcPath(): string {
  if (process.platform === 'win32') {
    return '\\\\.\\pipe\\sparkle\\service'
  }
  return '/tmp/sparkle-service.sock'
}

export function mihomoCoreDir(): string {
  if (systemCoreOnlyBuild) {
    return path.dirname(systemCorePath())
  }
  return path.join(resourcesDir(), 'sidecar')
}

export function mihomoCorePath(core: string): string {
  if (core === 'mihomo' || core === 'mihomo-alpha') {
    const isWin = process.platform === 'win32'
    return path.join(mihomoCoreDir(), `${core}${isWin ? '.exe' : ''}`)
  }
  if (core === 'system') {
    const sysPath = systemCorePath()
    if (!sysPath || !existsSync(sysPath)) {
      const errorMsg = sysPath ? `系统内核路径无效或不存在: ${sysPath}` : '系统内核路径未设置'
      throw new Error(errorMsg)
    }
    return sysPath
  }
  throw new Error('内核路径错误')
}

function systemCorePath(): string {
  const { systemCorePath = '' } = getAppConfigSync()
  return systemCorePath || systemCoreDefaultPath
}

export function servicePath(): string {
  if (systemCoreOnlyBuild) return systemServicePath
  const isWin = process.platform === 'win32'
  return path.join(resourcesFilesDir(), `sparkle-service${isWin ? '.exe' : ''}`)
}

export function serviceAuthStorePath(): string {
  return path.join(dataDir(), 'service-auth.json')
}

export function appConfigPath(): string {
  return path.join(dataDir(), 'config.yaml')
}

export function controledMihomoConfigPath(): string {
  return path.join(dataDir(), 'mihomo.yaml')
}

export function profileConfigPath(): string {
  return path.join(dataDir(), 'profile.yaml')
}

export function profilesDir(): string {
  return path.join(dataDir(), 'profiles')
}

export function profilePath(id: string): string {
  return path.join(profilesDir(), `${id}.yaml`)
}

export function overrideDir(): string {
  return path.join(dataDir(), 'override')
}

export function overrideConfigPath(): string {
  return path.join(dataDir(), 'override.yaml')
}

export function overridePath(id: string, ext: 'js' | 'yaml' | 'log'): string {
  return path.join(overrideDir(), `${id}.${ext}`)
}

export function mihomoWorkDir(): string {
  return path.join(dataDir(), 'work')
}

export function mihomoProfileWorkDir(id: string | undefined): string {
  return path.join(mihomoWorkDir(), id || 'default')
}

export function mihomoTestDir(): string {
  return path.join(dataDir(), 'test')
}

export function mihomoWorkConfigPath(id: string | undefined): string {
  if (id === 'work') {
    return path.join(mihomoWorkDir(), 'config.yaml')
  } else {
    return path.join(mihomoProfileWorkDir(id), 'config.yaml')
  }
}

export function logDir(): string {
  return path.join(dataDir(), 'logs')
}

function datedLogPath(prefix?: string): string {
  const date = new Date()
  const name = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  return path.join(logDir(), `${prefix ? `${prefix}-` : ''}${name}.log`)
}

export function logPath(): string {
  return datedLogPath()
}

export function appLogPath(): string {
  return datedLogPath('app')
}

export function coreLogPath(): string {
  return datedLogPath('core')
}

export function substoreLogPath(): string {
  return datedLogPath('sub-store')
}

const probeTimeoutMs = 15_000
const windowsProbeCleanupTimeoutMs = 3_000
const execFileAsync = promisify(execFile)
const coreSearchNames = ['mihomo', 'clash'] as const
type CoreSearchName = (typeof coreSearchNames)[number]
type PathLookupName = CoreSearchName | 'scoop' | 'brew' | 'rpm' | PackageManager
type WindowsProbeCommand =
  `where.exe ${PathLookupName}` | `scoop which ${CoreSearchName}` | 'scoop config global_path'
type ProbeError = ExecException & { stdout?: string; stderr?: string }

function runWindowsProbe(
  command: WindowsProbeCommand
): Promise<{ stdout: string; stderr: string }> {
  const systemRoot = process.env.SystemRoot
  if (!systemRoot) throw new Error('Windows system directory is unavailable')
  const systemDir = path.join(systemRoot, 'System32')

  return new Promise((resolve, reject) => {
    let timedOut = false
    // Set the code page in this hidden shell before reading native command output as UTF-8.
    const child = execFile(
      path.join(systemDir, 'cmd.exe'),
      ['/d', '/s', '/c', `"(chcp.com 65001 >nul || exit /b 3) & ${command}"`],
      { windowsHide: true, windowsVerbatimArguments: true },
      (error, stdout, stderr) => {
        clearTimeout(timer)
        if (timedOut) return
        if (error) reject(Object.assign(error, { stdout, stderr }))
        else resolve({ stdout, stderr })
      }
    )
    const timer = setTimeout(() => {
      timedOut = true
      const error = new Error(`Windows probe timed out: ${command}`)
      if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
        reject(error)
        return
      }

      // Terminate the tree while the shell still owns its children.
      execFileAsync(path.join(systemDir, 'taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        timeout: windowsProbeCleanupTimeoutMs
      }).then(
        () => reject(error),
        (cause) => {
          if (child.exitCode === null && child.signalCode === null) child.kill()
          reject(new Error(`${error.message} and its process tree could not be stopped`, { cause }))
        }
      )
    }, probeTimeoutMs)
  })
}

function splitOutput(output: string): string[] {
  return output.split(/\r?\n/).filter(Boolean)
}

function isMissingPath(error: unknown): boolean {
  const { code } = error as NodeJS.ErrnoException
  return code === 'ENOENT' || code === 'ENOTDIR'
}

async function isCandidateFile(file: string): Promise<boolean> {
  try {
    return (await stat(file)).isFile()
  } catch (error) {
    if (isMissingPath(error)) return false
    throw error
  }
}

async function findOnPath(name: PathLookupName): Promise<string[]> {
  const isWin = process.platform === 'win32'
  const command = isWin ? 'where.exe' : 'which'
  try {
    const { stdout, stderr } = isWin
      ? await runWindowsProbe(`where.exe ${name}`)
      : await execFileAsync('which', [name], {
          timeout: probeTimeoutMs,
          env: { ...process.env, LC_ALL: 'C' }
        })
    if (stderr.trim() || !stdout.trim()) throw new Error(`${command} failed to look up ${name}`)
    return splitOutput(stdout)
  } catch (error) {
    const { code, stdout, stderr } = error as ProbeError
    if (!isWin && code === 'ENOENT') return []
    if (code === 1 && !stdout?.trim()) {
      if (isWin || !stderr?.trim() || stderr.includes(`no ${name} in (`)) return []
    }
    throw error
  }
}

async function findInCommonDirs(): Promise<string[]> {
  const dirs = [
    '/bin',
    '/usr/bin',
    '/usr/local/bin',
    '/opt/homebrew/bin',
    path.join(homeDir, '.local/bin'),
    path.join(homeDir, 'bin')
  ]
  const candidates: string[] = []
  for (const dir of dirs) {
    try {
      for (const entry of await readdir(dir)) {
        if (coreSearchNames.some((name) => entry.startsWith(name))) {
          candidates.push(path.join(dir, entry))
        }
      }
    } catch (error) {
      if (!isMissingPath(error)) throw error
    }
  }
  return candidates
}

const packageQueries = {
  dpkg: '-L',
  pacman: '-Qql'
}
type PackageManager = keyof typeof packageQueries

async function findWithHomebrew(): Promise<string[]> {
  const [brew] = await findOnPath('brew')
  if (!brew) return []

  // The prefix alone avoids formula metadata lookups that may update Homebrew's cache.
  const { stdout, stderr } = await execFileAsync(brew, ['--prefix'], {
    timeout: probeTimeoutMs
  })
  const prefix = stdout.trim()
  if (stderr.trim() || !path.isAbsolute(prefix) || /[\r\n]/.test(prefix)) {
    throw new Error('Homebrew returned an invalid prefix')
  }
  return coreSearchNames.map((name) => path.join(prefix, 'opt', name, 'bin', name))
}

function isPackageMissing(
  manager: PackageManager,
  name: CoreSearchName,
  error: ProbeError
): boolean {
  if (error.code !== 1) return false
  const stdout = error.stdout?.trim() ?? ''
  const stderr = error.stderr?.trim() ?? ''
  switch (manager) {
    case 'dpkg':
      return !stdout && stderr.startsWith(`dpkg-query: package '${name}' is not installed`)
    case 'pacman':
      return !stdout && stderr.startsWith(`error: package '${name}' was not found`)
  }
}

async function findWithPackageManager(manager: PackageManager): Promise<string[]> {
  const [executable] = await findOnPath(manager)
  if (!executable) return []

  const env = { ...process.env, LC_ALL: 'C' }

  const candidates: string[] = []
  for (const name of coreSearchNames) {
    try {
      const { stdout, stderr } = await execFileAsync(executable, [packageQueries[manager], name], {
        timeout: probeTimeoutMs,
        env
      })
      if (stderr.trim()) throw new Error(`${manager} failed to look up ${name}`)
      candidates.push(
        ...splitOutput(stdout).filter(
          (file) => path.isAbsolute(file) && file.endsWith(`bin/${name}`)
        )
      )
    } catch (error) {
      if (!isPackageMissing(manager, name, error as ProbeError)) throw error
    }
  }
  return candidates
}

const rpmPrimaryFiles = ['rpmdb.sqlite', 'Packages.db', 'Packages']

async function canWriteRpmDatabase(dir: string): Promise<boolean> {
  const entries = await readdir(dir, { withFileTypes: true })
  if (entries.some((entry) => entry.isSymbolicLink())) return true
  for (const file of [dir, ...entries.map((entry) => path.join(dir, entry.name))]) {
    try {
      await access(file, constants.W_OK)
      return true
    } catch (error) {
      const { code } = error as NodeJS.ErrnoException
      if (code !== 'EACCES' && code !== 'EPERM' && code !== 'EROFS') throw error
    }
  }
  return false
}

async function readRpmDatabaseFiles(dir: string): Promise<Map<string, BigIntStats>> {
  const files = new Map<string, BigIntStats>()
  for (const name of [...rpmPrimaryFiles, 'rpmdb.sqlite-wal', 'rpmdb.sqlite-journal']) {
    try {
      const info = await stat(path.join(dir, name), { bigint: true })
      if (!info.isFile()) throw new Error(`RPM database entry is not a file: ${name}`)
      files.set(name, info)
    } catch (error) {
      if (!isMissingPath(error)) throw error
    }
  }
  return files
}

function sameRpmFile(before: BigIntStats, after: BigIntStats | undefined): boolean {
  return (
    after !== undefined &&
    before.dev === after.dev &&
    before.ino === after.ino &&
    before.size === after.size &&
    before.mtimeNs === after.mtimeNs &&
    before.ctimeNs === after.ctimeNs
  )
}

async function findWithRpm(): Promise<string[]> {
  const [rpm] = await findOnPath('rpm')
  if (!rpm) return []
  const options = { timeout: probeTimeoutMs, env: { ...process.env, LC_ALL: 'C' } }
  const config = await execFileAsync(rpm, ['--eval', '%{_dbpath}'], options)
  const dbPath = config.stdout.trim()
  if (config.stderr.trim() || !path.isAbsolute(dbPath) || /[\r\n]/.test(dbPath)) {
    throw new Error('RPM returned an invalid database path')
  }

  const files = await readRpmDatabaseFiles(dbPath)
  if (!rpmPrimaryFiles.some((file) => files.has(file))) return []

  const query = async (databasePath: string): Promise<string[]> => {
    const fallbackWarning =
      /^warning: Found (sqlite|ndb|bdb_ro|bdb) (?:rpmdb\.sqlite|Packages\.db|Packages) database while attempting [\w-]+ backend: using \1 backend\.$/
    const candidates: string[] = []
    for (const name of coreSearchNames) {
      // A filtered primary iterator avoids creating missing legacy name indexes.
      const { stdout, stderr } = await execFileAsync(
        rpm,
        [
          '--dbpath',
          databasePath,
          '--define',
          '_query_selector_match strcmp',
          '-qal',
          `NAME=${name}`
        ],
        options
      )
      if (
        splitOutput(stripVTControlCharacters(stderr).trim()).some(
          (line) => !fallbackWarning.test(line)
        )
      ) {
        throw new Error(`RPM failed to look up ${name}`)
      }
      candidates.push(
        ...splitOutput(stdout).filter(
          (file) => path.isAbsolute(file) && file.endsWith(`bin/${name}`)
        )
      )
    }
    return candidates
  }

  if (!(await canWriteRpmDatabase(dbPath))) return query(dbPath)

  // Query a private copy when RPM could create journals or locks in the live database.
  const dirBefore = await stat(dbPath, { bigint: true })
  const scratch = await mkdtemp(path.join(tmpdir(), 'sparkle-rpm-'))
  try {
    for (const file of files.keys()) {
      await copyFile(path.join(dbPath, file), path.join(scratch, file))
    }
    const after = await readRpmDatabaseFiles(dbPath)
    if (
      !sameRpmFile(dirBefore, await stat(dbPath, { bigint: true })) ||
      after.size !== files.size ||
      [...files].some(([name, info]) => !sameRpmFile(info, after.get(name)))
    ) {
      throw new Error('RPM database changed during discovery')
    }
    return await query(scratch)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

function isWindowsCorePath(file: string): boolean {
  return /\.(exe|com)$/i.test(file)
}

function expandScoopHomePath(file: string): string {
  return /^~[\\/]/.test(file) ? path.join(homeDir, file.slice(2)) : file
}

async function getScoopShimDirs(commands: string[], candidates: Set<string>): Promise<Set<string>> {
  const dirs = [path.join(process.env.SCOOP || path.join(homeDir, 'scoop'), 'shims')]
  const globalRoot =
    process.env.SCOOP_GLOBAL ||
    (process.env.ProgramData ? path.join(process.env.ProgramData, 'scoop') : undefined)
  if (globalRoot) dirs.push(path.join(globalRoot, 'shims'))
  for (const command of commands) {
    const dir = path.dirname(command)
    if (
      path.basename(command).toLowerCase() === 'scoop.cmd' &&
      path.basename(dir).toLowerCase() === 'shims'
    ) {
      dirs.push(dir)
    }
  }
  const shimDirs = new Set(dirs.map((dir) => path.resolve(expandScoopHomePath(dir)).toLowerCase()))
  if (commands.length && !process.env.SCOOP_GLOBAL) {
    const hasUnrecognizedShimDir = [...candidates].some((file) => {
      const dir = path.dirname(file).toLowerCase()
      return /\.exe$/i.test(file) && path.basename(dir) === 'shims' && !shimDirs.has(dir)
    })
    if (hasUnrecognizedShimDir) {
      const configuredDir = await getConfiguredScoopGlobalShimDir()
      if (configuredDir) shimDirs.add(configuredDir)
    }
  }
  return shimDirs
}

async function validateScoopExeShim(file: string): Promise<void> {
  if (!/\.exe$/i.test(file)) return
  const shimPath = file.replace(/\.exe$/i, '.shim')
  let definition: string
  try {
    definition = await readFile(shimPath, 'utf8')
  } catch (error) {
    if (isMissingPath(error)) {
      throw new Error(`Scoop shim is missing metadata for ${path.basename(file)}`)
    }
    throw error
  }

  const [pathLine] = splitOutput(definition)
  const target = /^path = "([^"]+)"$/.exec(pathLine?.trim() ?? '')?.[1]
  if (!target || !path.isAbsolute(target) || !isWindowsCorePath(target)) {
    throw new Error(`Scoop returned an invalid shim for ${path.basename(file)}`)
  }
  if (!(await isCandidateFile(target))) {
    const nativeTarget = target.replace(/\\Sysnative\\/i, '\\System32\\')
    if (nativeTarget === target || !(await isCandidateFile(nativeTarget))) {
      throw new Error(`Scoop could not resolve the ${path.basename(file)} shim`)
    }
  }
}

async function getConfiguredScoopGlobalShimDir(): Promise<string | undefined> {
  const { stdout, stderr } = await runWindowsProbe('scoop config global_path')
  const root = stripVTControlCharacters(stdout).trim()
  if (stderr.trim() || /[\r\n]/.test(root)) throw new Error('Scoop returned an invalid global path')
  if (!root || root === "'global_path' is not set") return

  return path.resolve(expandScoopHomePath(root), 'shims').toLowerCase()
}

async function findWithScoop(name: CoreSearchName): Promise<string | undefined> {
  const notFound = [
    `WARN  '${name}' not found, not a scoop shim, or a broken shim.`,
    `'${name}' not found / not a scoop shim.`
  ]
  let output: string
  try {
    // Scoop is commonly a .cmd shim and needs the Windows command shell.
    const { stdout, stderr } = await runWindowsProbe(`scoop which ${name}`)
    output = stripVTControlCharacters(stdout).trim()
    if (stderr.trim()) throw new Error(`Scoop failed to look up ${name}`)
  } catch (error) {
    const { code, stdout, stderr } = error as ProbeError
    if (
      code === 2 &&
      !stderr?.trim() &&
      notFound.includes(stripVTControlCharacters(stdout ?? '').trim())
    ) {
      return undefined
    }
    throw error
  }

  if (notFound.includes(output)) return undefined
  // Scoop shortens paths inside the home directory before printing them.
  const target = expandScoopHomePath(output)
  if (!path.isAbsolute(target) || /[\r\n]/.test(target) || !(await isCandidateFile(target))) {
    throw new Error(`Scoop returned an invalid target for ${name}`)
  }
  return isWindowsCorePath(target) ? target : undefined
}

export async function findSystemMihomo(): Promise<string[]> {
  const platform = process.platform
  const scoopCommands = platform === 'win32' ? await findOnPath('scoop') : []
  const foundPaths = new Set<string>()
  for (const name of coreSearchNames) {
    for (const file of await findOnPath(name)) {
      if (platform === 'win32' && !isWindowsCorePath(file)) continue
      if (!(await isCandidateFile(file))) throw new Error(`Invalid PATH candidate for ${name}`)
      foundPaths.add(file)
    }
  }

  if (platform === 'win32') {
    const scoopShimDirs = await getScoopShimDirs(scoopCommands, foundPaths)
    for (const file of foundPaths) {
      if (scoopShimDirs.has(path.dirname(file).toLowerCase())) await validateScoopExeShim(file)
    }
    if (scoopCommands.length) {
      for (const name of coreSearchNames) {
        const target = await findWithScoop(name)
        if (target) foundPaths.add(target)
      }
    }
  } else {
    for (const file of await findInCommonDirs()) {
      if (await isCandidateFile(file)) foundPaths.add(file)
    }
    if (platform === 'darwin' || platform === 'linux') {
      for (const file of await findWithHomebrew()) {
        if (await isCandidateFile(file)) foundPaths.add(file)
      }
    }
    if (platform === 'linux') {
      const candidates = [
        ...(await findWithPackageManager('dpkg')),
        ...(await findWithRpm()),
        ...(await findWithPackageManager('pacman'))
      ]
      for (const file of candidates) {
        if (await isCandidateFile(file)) foundPaths.add(file)
      }
    }
  }

  if (
    systemCoreDefaultPath &&
    (platform !== 'win32' || isWindowsCorePath(systemCoreDefaultPath)) &&
    (await isCandidateFile(systemCoreDefaultPath))
  ) {
    foundPaths.add(systemCoreDefaultPath)
  }
  return [...foundPaths].sort()
}
