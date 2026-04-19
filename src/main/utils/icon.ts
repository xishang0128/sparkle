import axios from 'axios'
import { getControledMihomoConfig } from '../config'
import fs, { existsSync } from 'fs'
import path from 'path'
import { getIcon } from 'file-icon-info'
import { windowsDefaultIcon, darwinDefaultIcon, otherDevicesIcon } from './defaultIcon'
import { app } from 'electron'
import os from 'os'
import crypto from 'crypto'
import { exec } from 'child_process'

export function isIOSApp(appPath: string): boolean {
  const appDir = appPath.endsWith('.app')
    ? appPath
    : appPath.includes('.app')
      ? appPath.substring(0, appPath.indexOf('.app') + 4)
      : path.dirname(appPath)

  return !fs.existsSync(path.join(appDir, 'Contents'))
}

function hasIOSAppIcon(appPath: string): boolean {
  try {
    const items = fs.readdirSync(appPath)
    return items.some((item) => {
      const lower = item.toLowerCase()
      const ext = path.extname(item).toLowerCase()
      return lower.startsWith('appicon') && (ext === '.png' || ext === '.jpg' || ext === '.jpeg')
    })
  } catch {
    return false
  }
}

function hasMacOSAppIcon(appPath: string): boolean {
  const resourcesDir = path.join(appPath, 'Contents', 'Resources')
  if (!fs.existsSync(resourcesDir)) {
    return false
  }

  try {
    const items = fs.readdirSync(resourcesDir)
    return items.some((item) => path.extname(item).toLowerCase() === '.icns')
  } catch {
    return false
  }
}

export function findBestAppPath(appPath: string): string | null {
  if (!appPath.includes('.app') && !appPath.includes('.xpc')) {
    return null
  }

  const parts = appPath.split(path.sep)
  const appPaths: string[] = []

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].endsWith('.app') || parts[i].endsWith('.xpc')) {
      const fullPath = parts.slice(0, i + 1).join(path.sep)
      appPaths.push(fullPath)
    }
  }
  if (appPaths.length === 0) {
    return null
  }
  if (appPaths.length === 1) {
    return appPaths[0]
  }
  for (let i = appPaths.length - 1; i >= 0; i--) {
    const appDir = appPaths[i]
    if (isIOSApp(appDir)) {
      if (hasIOSAppIcon(appDir)) {
        return appDir
      }
    } else {
      if (hasMacOSAppIcon(appDir)) {
        return appDir
      }
    }
  }
  return appPaths[0]
}

function normalizeLinuxAppId(value: string): string {
  return path
    .basename(value.trim())
    .replace(/\.desktop$/i, '')
    .toLowerCase()
}

function tokenizeLinuxAppId(value: string): string[] {
  return normalizeLinuxAppId(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

function getLinuxDesktopDirs(): string[] {
  const homeDir = process.env.HOME || os.homedir()
  const dataHome = process.env.XDG_DATA_HOME || path.join(homeDir, '.local', 'share')
  const dataDirs = (process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share')
    .split(path.delimiter)
    .filter(Boolean)

  return Array.from(new Set([dataHome, ...dataDirs].map((dir) => path.join(dir, 'applications'))))
}

function collectDesktopFiles(dir: string, files: string[] = []): string[] {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        collectDesktopFiles(fullPath, files)
        continue
      }

      if (entry.isFile() && entry.name.endsWith('.desktop')) {
        files.push(fullPath)
      }
    }
  } catch {
    return files
  }

  return files
}

function getDesktopEntryValue(content: string, key: string): string | null {
  const match = content.match(new RegExp(`^${key}\\s*=\\s*(.+?)$`, 'm'))
  return match ? match[1].trim() : null
}

const shellAssignmentPattern = /^[A-Za-z_][A-Za-z0-9_]*=/
const shellRedirectionPattern = /^(\d*)[<>]/
const linuxScriptDirVariablePattern = /^\$(?:\{(HERE|DIR)\}|(HERE|DIR))(?:\/(.*))?$/
const strongLinuxFallbackRank = 20

function parseShellWords(command: string): string[] {
  const words: string[] = []
  let current = ''
  let quote: '"' | "'" | '' = ''
  let escaped = false

  for (const char of command.trim()) {
    if (escaped) {
      current += char
      escaped = false
      continue
    }

    if (char === '\\' && quote !== "'") {
      escaped = true
      continue
    }

    if (quote) {
      if (char === quote) {
        quote = ''
      } else {
        current += char
      }
      continue
    }

    if (char === '"' || char === "'") {
      quote = char
      continue
    }

    if (/\s/.test(char)) {
      if (current) {
        words.push(current)
        current = ''
      }
      continue
    }

    current += char
  }

  if (escaped) current += '\\'
  if (current) words.push(current)

  return words
}

function parseDesktopExecCommand(command: string): string {
  return parseShellWords(command)[0] || ''
}

function isDesktopEntryDisabled(content: string): boolean {
  return /^(NoDisplay|Hidden)\s*=\s*true\s*$/im.test(content)
}

function resolveExistingLinuxPath(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null
  }

  try {
    return fs.realpathSync.native(filePath)
  } catch {
    return path.resolve(filePath)
  }
}

function resolveLinuxCommandPath(command: string): string | null {
  const commandPath = parseDesktopExecCommand(command)
  if (!commandPath) {
    return null
  }

  if (path.isAbsolute(commandPath)) {
    return resolveExistingLinuxPath(commandPath)
  }

  if (commandPath.includes(path.sep)) {
    return resolveExistingLinuxPath(path.resolve(commandPath))
  }

  const envPath = process.env.PATH || ''
  for (const dir of envPath.split(path.delimiter).filter(Boolean)) {
    const resolved = resolveExistingLinuxPath(path.join(dir, commandPath))
    if (resolved) {
      return resolved
    }
  }

  return null
}

function readLinuxScript(filePath: string): string | null {
  try {
    const stat = fs.statSync(filePath)
    if (!stat.isFile() || stat.size > 256 * 1024) {
      return null
    }

    const content = fs.readFileSync(filePath)
    if (content.includes(0)) {
      return null
    }

    return content.toString('utf-8')
  } catch {
    return null
  }
}

function expandLinuxScriptCommand(command: string, scriptPath: string): string {
  const match = command.match(linuxScriptDirVariablePattern)
  if (!match) return command

  return match[3] ? path.join(path.dirname(scriptPath), match[3]) : path.dirname(scriptPath)
}

function extractExecCommandFromScriptLine(line: string, scriptPath: string): string | null {
  const words = parseShellWords(line)
  if (words[0] !== 'exec') {
    return null
  }

  let index = 1
  while (index < words.length && shellAssignmentPattern.test(words[index])) {
    index++
  }

  while (index < words.length) {
    const word = words[index]
    if (word === '--') {
      index++
      break
    }
    if (word === '-a') {
      index += 2
      continue
    }
    if (word === '-c' || word === '-l') {
      index++
      continue
    }
    break
  }

  const command = expandLinuxScriptCommand(words[index] || '', scriptPath).trim()

  if (!command || command.startsWith('$') || shellRedirectionPattern.test(command)) {
    return null
  }

  return command
}

function collectLinuxExecTargets(entry: string, seen = new Set<string>(), depth = 0): Set<string> {
  const targets = new Set<string>()
  if (!entry || depth > 4) {
    return targets
  }

  const resolvedPath = resolveLinuxCommandPath(entry)
  if (!resolvedPath || seen.has(resolvedPath)) {
    return targets
  }

  seen.add(resolvedPath)
  targets.add(resolvedPath)

  const script = readLinuxScript(resolvedPath)
  if (!script) {
    return targets
  }

  for (const line of script.split(/\r?\n/)) {
    const command = extractExecCommandFromScriptLine(line, resolvedPath)
    if (!command) {
      continue
    }

    const nextEntry =
      !path.isAbsolute(command) && command.includes(path.sep)
        ? path.resolve(path.dirname(resolvedPath), command)
        : command

    for (const target of collectLinuxExecTargets(nextEntry, seen, depth + 1)) {
      targets.add(target)
    }
  }

  return targets
}

function getLinuxPathCandidates(value: string): string[] {
  return [value, path.basename(value), path.basename(value, path.extname(value))]
}

function getLinuxAppIds(appPath: string, execTargets: Iterable<string> = []): Set<string> {
  const appIds = new Set<string>()

  const addCandidates = (value: string): void => {
    for (const candidate of getLinuxPathCandidates(value)) {
      const normalized = normalizeLinuxAppId(candidate)
      if (normalized) {
        appIds.add(normalized)
      }
    }
  }

  addCandidates(appPath)

  for (const target of execTargets) {
    addCandidates(target)
  }

  return appIds
}

function matchLinuxAppId(entryValue: string, appIds: Set<string>): number {
  const entryId = normalizeLinuxAppId(entryValue)
  if (!entryId) {
    return 0
  }
  if (appIds.has(entryId)) {
    return 2
  }

  const entryTokens = tokenizeLinuxAppId(entryId)
  for (const candidate of appIds) {
    const candidateTokens = tokenizeLinuxAppId(candidate)
    if (candidateTokens.length === 0 || entryTokens.length === 0) {
      continue
    }

    const candidateCovered = candidateTokens.every((token) => entryTokens.includes(token))
    const entryCovered = entryTokens.every((token) => candidateTokens.includes(token))
    const singleTokenAlias =
      (candidateTokens.length === 1 &&
        candidateTokens[0].length >= 4 &&
        entryTokens.includes(candidateTokens[0])) ||
      (entryTokens.length === 1 &&
        entryTokens[0].length >= 4 &&
        candidateTokens.includes(entryTokens[0]))

    if (candidateCovered || entryCovered || singleTokenAlias) {
      return 1
    }
  }

  return 0
}

function getExecTargetMatchRank(entry: string | null, appExecTargets: Set<string>): number {
  if (!entry || appExecTargets.size === 0) {
    return 0
  }

  const directTarget = resolveLinuxCommandPath(entry)
  if (directTarget && appExecTargets.has(directTarget)) {
    return 2
  }

  for (const target of collectLinuxExecTargets(entry)) {
    if (appExecTargets.has(target)) {
      return 1
    }
  }

  return 0
}

function getDesktopFileRank(
  appPath: string,
  appIds: Set<string>,
  appExecTargets: Set<string>,
  fileName: string,
  content: string
): { strict: number; fallback: number } {
  let strict = 0
  let fallback = matchLinuxAppId(fileName, appIds) * 10
  const execCommand = getDesktopEntryValue(content, 'Exec')
  const tryExecCommand = getDesktopEntryValue(content, 'TryExec')
  const visibleBonus = isDesktopEntryDisabled(content) ? 0 : 1
  const execRank = getExecTargetMatchRank(execCommand, appExecTargets)
  const tryExecRank = getExecTargetMatchRank(tryExecCommand, appExecTargets)

  if (execRank > 0) {
    strict = Math.max(strict, execRank * 20 + visibleBonus)
  }
  if (tryExecRank > 0) {
    strict = Math.max(strict, tryExecRank * 18 + visibleBonus)
  }

  if (execCommand) {
    const execPath = parseDesktopExecCommand(execCommand)
    if (execPath) {
      if (execPath === appPath || execPath.endsWith(appPath) || appPath.endsWith(execPath)) {
        fallback = Math.max(fallback, 30)
      }

      fallback = Math.max(fallback, matchLinuxAppId(execPath, appIds) * 12)
    }
  }

  if (tryExecCommand) {
    fallback = Math.max(fallback, matchLinuxAppId(tryExecCommand, appIds) * 11)
  }

  for (const [key, weight] of [
    ['StartupWMClass', 9],
    ['Icon', 8],
    ['Name', 6],
    ['GenericName', 5]
  ] as const) {
    const value = getDesktopEntryValue(content, key)
    if (value) {
      fallback = Math.max(fallback, matchLinuxAppId(value, appIds) * weight)
    }
  }

  return { strict, fallback }
}

async function findDesktopFile(appPath: string): Promise<string | null> {
  try {
    const desktopDirs = getLinuxDesktopDirs()
    const appExecTargets = collectLinuxExecTargets(appPath)
    const appIds = getLinuxAppIds(appPath, appExecTargets)
    const useStrictExecMatch = path.isAbsolute(appPath)
    let bestStrictMatch: { rank: number; fullPath: string } | null = null
    let bestFallbackMatch: { rank: number; fullPath: string } | null = null

    for (const dir of desktopDirs) {
      if (!existsSync(dir)) continue

      const desktopFiles = collectDesktopFiles(dir)

      for (const fullPath of desktopFiles) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8')
          const { strict, fallback } = getDesktopFileRank(
            appPath,
            appIds,
            appExecTargets,
            path.basename(fullPath),
            content
          )

          if (
            useStrictExecMatch &&
            strict > 0 &&
            (!bestStrictMatch || strict > bestStrictMatch.rank)
          ) {
            bestStrictMatch = { rank: strict, fullPath }
          }
          if (fallback > 0 && (!bestFallbackMatch || fallback > bestFallbackMatch.rank)) {
            bestFallbackMatch = { rank: fallback, fullPath }
          }
        } catch {
          continue
        }
      }
    }

    if (bestStrictMatch) {
      return bestStrictMatch.fullPath
    }

    if (
      useStrictExecMatch &&
      (!bestFallbackMatch || bestFallbackMatch.rank < strongLinuxFallbackRank)
    ) {
      return null
    }

    return bestFallbackMatch?.fullPath || null
  } catch {
    return null
  }
}

function parseIconNameFromDesktopFile(content: string): string | null {
  const match = content.match(/^Icon\s*=\s*(.+?)$/m)
  return match ? match[1].trim() : null
}

function resolveIconPath(iconName: string): string | null {
  if (path.isAbsolute(iconName) && existsSync(iconName)) {
    return iconName
  }

  const searchPaths: string[] = []
  const sizes = ['512x512', '256x256', '128x128', '64x64', '48x48', '32x32', '24x24', '16x16']
  const extensions = ['png', 'svg', 'xpm']
  const iconDirs = [
    '/usr/share/icons/hicolor',
    '/usr/share/pixmaps',
    '/usr/share/icons/Adwaita',
    `${process.env.HOME}/.local/share/icons`
  ]

  for (const dir of iconDirs) {
    for (const size of sizes) {
      for (const ext of extensions) {
        searchPaths.push(path.join(dir, size, 'apps', `${iconName}.${ext}`))
      }
    }
  }
  for (const ext of extensions) {
    searchPaths.push(`/usr/share/pixmaps/${iconName}.${ext}`)
  }
  for (const dir of iconDirs) {
    for (const ext of extensions) {
      searchPaths.push(path.join(dir, `${iconName}.${ext}`))
    }
  }

  return searchPaths.find((iconPath) => existsSync(iconPath)) || null
}

function getIconMimeType(iconPath: string): string {
  const ext = path.extname(iconPath).toLowerCase()

  if (ext === '.svg') {
    return 'image/svg+xml'
  }
  if (ext === '.xpm') {
    return 'image/x-xpixmap'
  }

  return 'image/png'
}

export async function getIconDataURL(appPath: string): Promise<string> {
  if (!appPath) {
    return otherDevicesIcon
  }
  if (appPath === 'mihomo') {
    appPath = app.getPath('exe')
  }

  if (process.platform === 'darwin') {
    if (!appPath.includes('.app') && !appPath.includes('.xpc')) {
      return darwinDefaultIcon
    }
    const { fileIconToBuffer } = await import('file-icon')
    const targetPath = findBestAppPath(appPath)
    if (!targetPath) {
      return darwinDefaultIcon
    }
    const iconBuffer = await fileIconToBuffer(targetPath, { size: 512 })
    const base64Icon = Buffer.from(iconBuffer).toString('base64')
    return `data:image/png;base64,${base64Icon}`
  }

  if (process.platform === 'win32') {
    if (appPath.startsWith('\\Device\\')) {
      const { resolveWithDosDeviceMappings } = await import('./devicePathResolver')
      const resolvePath = resolveWithDosDeviceMappings(appPath)
      if (resolvePath) {
        appPath = resolvePath
      }
    }
    if (fs.existsSync(appPath) && /\.(exe|dll)$/i.test(appPath)) {
      try {
        let targetPath = appPath
        let tempLinkPath: string | null = null

        if (/[\u4e00-\u9fff]/.test(appPath)) {
          const tempDir = os.tmpdir()
          const randomName = crypto.randomBytes(8).toString('hex')
          const fileExt = path.extname(appPath)
          tempLinkPath = path.join(tempDir, `${randomName}${fileExt}`)

          try {
            exec(`mklink "${tempLinkPath}" "${appPath}"`)
            targetPath = tempLinkPath
          } catch {
            // ignore
          }
        }

        const iconBuffer = await new Promise<Buffer>((resolve, reject) => {
          getIcon(targetPath, (b64d) => {
            try {
              resolve(Buffer.from(b64d, 'base64'))
            } catch (err) {
              reject(err)
            }
          })
        })

        if (tempLinkPath && fs.existsSync(tempLinkPath)) {
          try {
            fs.unlinkSync(tempLinkPath)
          } catch {
            // ignore
          }
        }

        return `data:image/png;base64,${iconBuffer.toString('base64')}`
      } catch {
        return windowsDefaultIcon
      }
    } else {
      return windowsDefaultIcon
    }
  } else if (process.platform === 'linux') {
    const desktopFile = await findDesktopFile(appPath)
    if (desktopFile) {
      const content = fs.readFileSync(desktopFile, 'utf-8')
      const iconName = parseIconNameFromDesktopFile(content)
      if (iconName) {
        const iconPath = resolveIconPath(iconName)
        if (iconPath) {
          try {
            const iconBuffer = fs.readFileSync(iconPath)
            const mimeType = getIconMimeType(iconPath)
            return `data:${mimeType};base64,${iconBuffer.toString('base64')}`
          } catch {
            return darwinDefaultIcon
          }
        }
      }
    }

    return darwinDefaultIcon
  }

  return ''
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
