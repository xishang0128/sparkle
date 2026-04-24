import path from 'path'
import type { CoreStartupHook } from './startupHook'
import { mihomoIpcPath, mihomoProfileWorkDir, mihomoWorkDir } from '../utils/dirs'

interface RuntimeConfigProviders {
  'rule-providers'?: Record<string, unknown>
  'proxy-providers'?: Record<string, unknown>
}

export interface CoreEnvironmentOptions {
  disableLoopbackDetector: boolean
  disableEmbedCA: boolean
  disableSystemCA: boolean
  disableNftables: boolean
  safePaths: string[]
}

export interface CoreSpawnArgsOptions {
  current: string | undefined
  diffWorkDir: boolean
  ctlParam: string
  coreHook?: CoreStartupHook
}

export interface ProviderInitializationTracker {
  hasProviders: boolean
  track: (logLine: string) => void
  isReady: (logLine: string) => boolean
}

export function createCoreEnvironment(
  options: CoreEnvironmentOptions
): Record<string, string | undefined> {
  return {
    DISABLE_LOOPBACK_DETECTOR: String(options.disableLoopbackDetector),
    DISABLE_EMBED_CA: String(options.disableEmbedCA),
    DISABLE_SYSTEM_CA: String(options.disableSystemCA),
    DISABLE_NFTABLES: String(options.disableNftables),
    SAFE_PATHS: options.safePaths.join(path.delimiter),
    PATH: process.env.PATH
  }
}

export function createCoreSpawnArgs(options: CoreSpawnArgsOptions): string[] {
  const spawnArgs = [
    '-d',
    options.diffWorkDir ? mihomoProfileWorkDir(options.current) : mihomoWorkDir(),
    options.ctlParam,
    mihomoIpcPath()
  ]

  if (options.coreHook) {
    spawnArgs.push(
      '-post-up',
      options.coreHook.postUpCommand,
      '-post-down',
      options.coreHook.postDownCommand
    )
  }

  return spawnArgs
}

export function createProviderInitializationTracker(
  runtimeConfig: RuntimeConfigProviders
): ProviderInitializationTracker {
  const providerNames = new Set(
    [
      ...Object.keys(runtimeConfig['rule-providers'] || {}),
      ...Object.keys(runtimeConfig['proxy-providers'] || {})
    ].map(normalizeProviderName)
  )
  const unmatchedProviders = new Set(providerNames)

  return {
    hasProviders: providerNames.size > 0,
    track: (logLine) => {
      for (const match of logLine.matchAll(/Start initial provider ([^"]+)"/g)) {
        const name = normalizeProviderName(match[1])
        if (providerNames.has(name)) {
          unmatchedProviders.delete(name)
        }
      }
    },
    isReady: (logLine) => {
      const isDefaultProvider = logLine.includes('Start initial compatible provider default')
      const isAllProvidersMatched = providerNames.size > 0 && unmatchedProviders.size === 0
      return (providerNames.size === 0 && isDefaultProvider) || isAllProvidersMatched
    }
  }
}

export function isControllerListenError(logLine: string): boolean {
  return (
    (process.platform !== 'win32' && logLine.includes('External controller unix listen error')) ||
    (process.platform === 'win32' && logLine.includes('External controller pipe listen error'))
  )
}

export function isControllerReadyLog(logLine: string): boolean {
  return (
    (process.platform !== 'win32' && logLine.includes('RESTful API unix listening at')) ||
    (process.platform === 'win32' && logLine.includes('RESTful API pipe listening at'))
  )
}

export function isTunPermissionError(logLine: string): boolean {
  return logLine.includes(
    'Start TUN listening error: configure tun interface: Connect: operation not permitted'
  )
}

export function isUpdaterFinishedLog(logLine: string): boolean {
  return process.platform === 'win32' && logLine.includes('updater: finished')
}

function normalizeProviderName(value: string): string {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .normalize('NFC')
}
