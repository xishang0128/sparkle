import { app } from 'electron'
import axios from 'axios'
import { randomUUID } from 'crypto'
import { AsyncLocalStorage } from 'async_hooks'
import { getAppConfig } from '../config/app'
import { appendAppLog } from '../utils/log'

const sessionId = randomUUID()
const queueLimit = 100
const operationContext = new AsyncLocalStorage<{ active: boolean }>()
interface TargetDelivery {
  queue: { url: string; event: WebhookEvent }[]
  delivery?: Promise<void>
}
const targets = new Map<string, TargetDelivery>()
let sequence = 0
let enqueue: Promise<void> = Promise.resolve()
let coreState: { mode: string; pid?: number } | undefined

function log(message: string): void {
  void appendAppLog(`[Webhook]: ${message}\n`).catch(() => {})
}

export function validateWebhookTarget(config: WebhookTarget): void {
  if (config.url) {
    let url: URL
    try {
      url = new URL(config.url)
    } catch {
      throw new Error('Webhook 地址无效')
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Webhook 仅支持 HTTP/HTTPS，请使用访问令牌认证')
    }
  } else {
    throw new Error('请先填写 Webhook 地址')
  }
  if (config.token && /[\r\n]/.test(config.token)) throw new Error('Webhook 访问令牌无效')
  if (
    config.timeout !== undefined &&
    (!Number.isInteger(config.timeout) || config.timeout < 1000 || config.timeout > 10000)
  ) {
    throw new Error('Webhook 超时应为 1000–10000 毫秒')
  }
  if (config.categories?.some((category) => !Object.hasOwn(operations, category)))
    throw new Error('Webhook 事件类别无效')
}

export function validateWebhookConfig(config: WebhookConfig): void {
  const ids = new Set<string>()
  for (const target of config.targets ?? []) {
    if (!target.id || ids.has(target.id)) throw new Error('Webhook 目标标识无效或重复')
    ids.add(target.id)
    if (target.url || target.enabled !== false) validateWebhookTarget(target)
  }
}

async function send(config: WebhookTarget, event: WebhookEvent): Promise<void> {
  validateWebhookTarget(config)
  const timeout = config.timeout ?? 3000
  await axios.post(config.url!, event, {
    headers: {
      'Content-Type': 'application/json',
      ...(config.token ? { Authorization: `Bearer ${config.token}` } : {})
    },
    timeout,
    signal: AbortSignal.timeout(timeout),
    proxy: false,
    maxRedirects: 0,
    maxContentLength: 64 * 1024,
    maxBodyLength: 64 * 1024
  })
}

function drain(id: string, state: TargetDelivery): void {
  if (state.delivery) return
  state.delivery = (async () => {
    while (state.queue.length) {
      const item = state.queue.shift()!
      const { webhook } = await getAppConfig()
      const target = webhook?.targets?.find((target) => target.id === id)
      if (
        !target ||
        target.enabled === false ||
        target.url !== item.url ||
        (target.categories && !target.categories.includes(item.event.category))
      )
        continue
      try {
        await send(target, item.event)
      } catch (error) {
        // Axios errors include the URL, authorization headers and request body.
        const reason = axios.isAxiosError(error)
          ? (error.response?.status ?? error.code ?? 'request failed')
          : 'invalid configuration'
        log(`target ${id}: ${item.event.action} delivery failed (${reason})`)
      }
    }
  })()
    .catch(() => log('delivery failed'))
    .finally(() => {
      state.delivery = undefined
      if (state.queue.length) drain(id, state)
      else targets.delete(id)
    })
}

export function emitWebhook(
  category: WebhookCategory,
  action: string,
  data: WebhookEvent['data'] = {},
  status: WebhookEvent['status'] = 'success',
  source: WebhookEvent['source'] = 'core'
): void {
  const event: WebhookEvent = {
    schemaVersion: 1,
    id: randomUUID(),
    sessionId,
    sequence: ++sequence,
    timestamp: new Date().toISOString(),
    name: '',
    version: app.getVersion(),
    platform: process.platform,
    category,
    action,
    status,
    source,
    data
  }
  enqueue = enqueue
    .then(async () => {
      const { webhook } = await getAppConfig()
      for (const target of webhook?.targets ?? []) {
        if (
          target.enabled === false ||
          !target.url ||
          (target.categories && !target.categories.includes(category))
        )
          continue
        const state = targets.get(target.id) ?? { queue: [] }
        targets.set(target.id, state)
        if (state.queue.length >= queueLimit) {
          const index = state.queue.findIndex((item) => item.event.category !== 'lifecycle')
          if (index < 0) {
            log(`target ${target.id}: queue full, event dropped`)
            continue
          }
          state.queue.splice(index, 1)
          log(`target ${target.id}: queue full, oldest operation dropped`)
        }
        state.queue.push({ url: target.url, event: { ...event, name: target.name ?? '' } })
        drain(target.id, state)
      }
    })
    .catch(() => log('enqueue failed'))
}

export async function flushWebhooks(): Promise<void> {
  let timer: NodeJS.Timeout | undefined
  await Promise.race([
    (async () => {
      await enqueue
      await Promise.all([...targets.values()].map((state) => state.delivery))
    })(),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, 3000)
    })
  ]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export async function testWebhook(config: WebhookTarget): Promise<void> {
  await send(config, {
    schemaVersion: 1,
    id: randomUUID(),
    sessionId,
    sequence: ++sequence,
    timestamp: new Date().toISOString(),
    name: config.name ?? '',
    version: app.getVersion(),
    platform: process.platform,
    category: 'application',
    action: 'webhook.test',
    status: 'success',
    source: 'ipc',
    data: {}
  }).catch((error) => {
    const reason = axios.isAxiosError(error)
      ? (error.response?.status ?? error.code ?? '请求失败')
      : '配置无效'
    throw new Error(`Webhook 测试失败：${reason}`)
  })
}

export function notifyCoreStarted(mode: string, pid?: number): void {
  if (coreState?.mode === mode && coreState.pid === pid) return
  coreState = { mode, pid }
  emitWebhook('lifecycle', 'core.started', { mode, pid })
}

export function notifyCoreStopped(mode: string, pid?: number, reason = 'stopped'): void {
  if (!coreState || coreState.mode !== mode || (pid !== undefined && coreState.pid !== pid)) return
  const stopped = coreState
  coreState = undefined
  emitWebhook('lifecycle', 'core.stopped', { ...stopped, reason })
}

export function operationData(action: string, args: unknown[]): WebhookEvent['data'] {
  const first = args[0]
  if (
    (action.startsWith('patch') || action.startsWith('set')) &&
    first &&
    typeof first === 'object'
  ) {
    const patch = first as {
      tun?: { enable?: boolean }
      dns?: { enable?: boolean }
      sniffer?: { enable?: boolean }
      sysProxy?: { enable?: boolean }
      mode?: string
    }
    return {
      fields: Object.keys(first),
      tunEnabled: patch.tun?.enable,
      dnsEnabled: patch.dns?.enable,
      sniffEnabled: patch.sniffer?.enable,
      sysProxyEnabled: patch.sysProxy?.enable,
      mode: patch.mode
    }
  }
  if (action === 'triggerSysProxy') return { enabled: first }
  if (action === 'mihomoChangeProxy') return { group: args[0], proxy: args[1] }
  if (
    /^(changeCurrentProfile|removeProfileItem|removeOverrideItem|setProfileStr|setOverride)$/.test(
      action
    )
  )
    return { id: first }
  return {}
}

export async function runWebhookOperation<T>(
  category: WebhookCategory,
  action: string,
  callback: () => T | Promise<T>,
  data: WebhookEvent['data'] = {},
  source: WebhookEvent['source'] = 'ipc'
): Promise<T> {
  const start = Date.now()
  const context = { active: true }
  return operationContext.run(context, async () => {
    let status: WebhookEvent['status'] = 'success'
    try {
      const result = await callback()
      if (result && typeof result === 'object' && 'invokeError' in result) status = 'failure'
      return result
    } catch (error) {
      status = 'failure'
      throw error
    } finally {
      context.active = false
      emitWebhook(category, action, { ...data, durationMs: Date.now() - start }, status, source)
    }
  })
}

export function notifyConfigOperation(action: string, patch: object): void {
  if (operationContext.getStore()?.active) return
  emitWebhook(
    action === 'patchAppConfig' ? 'settings' : 'network',
    action,
    operationData(action, [patch]),
    'success',
    'config'
  )
}

const operations: Record<WebhookCategory, string[]> = {
  lifecycle: ['restartCore', 'stopCore', 'quitWithoutCore'],
  network: [
    'patchControledMihomoConfig',
    'patchMihomoConfig',
    'triggerSysProxy',
    'mihomoChangeProxy',
    'mihomoUnfixedProxy',
    'mihomoUpdateProxyProviders',
    'mihomoUpdateRuleProviders',
    'mihomoProxyDelay',
    'mihomoGroupDelay',
    'startNetworkDetection',
    'stopNetworkDetection'
  ],
  profiles: [
    'setProfileConfig',
    'addProfileItem',
    'removeProfileItem',
    'updateProfileItem',
    'changeCurrentProfile',
    'setProfileStr',
    'setFileStr',
    'saveFileStrWithElevation',
    'setOverrideConfig',
    'addOverrideItem',
    'removeOverrideItem',
    'updateOverrideItem',
    'setOverride'
  ],
  connections: [
    'mihomoCloseConnection',
    'mihomoCloseConnections',
    'mihomoRulesDisable',
    'clearCachedMihomoLogs'
  ],
  settings: [
    'patchAppConfig',
    'resetAppConfig',
    'enableAutoRun',
    'disableAutoRun',
    'registerShortcut',
    'writeTheme',
    'importThemes'
  ],
  service: [
    'initService',
    'installService',
    'uninstallService',
    'startService',
    'restartService',
    'stopService',
    'manualGrantCorePermition',
    'revokeCorePermission',
    'deleteElevateTask',
    'setupFirewall'
  ],
  tools: [
    'webdavBackup',
    'webdavRestore',
    'webdavDelete',
    'startSubStoreFrontendServer',
    'stopSubStoreFrontendServer',
    'startSubStoreBackendServer',
    'stopSubStoreBackendServer',
    'downloadSubStore',
    'mihomoUpgrade',
    'mihomoUpgradeGeo',
    'mihomoUpgradeUI',
    'downloadAndInstallUpdate',
    'cancelUpdate',
    'copyEnv',
    'openFile',
    'openUWPTool',
    'createHeapSnapshot',
    'generateAgeKeyPair'
  ],
  application: [
    'setAlwaysOnTop',
    'setDockVisible',
    'showTrayIcon',
    'closeTrayIcon',
    'showMainWindow',
    'closeMainWindow',
    'triggerMainWindow',
    'showFloatingWindow',
    'closeFloatingWindow',
    'openDevTools',
    'relaunchApp',
    'quitApp',
    'notDialogQuit'
  ]
}

export const webhookOperationCategories = new Map(
  Object.entries(operations).flatMap(([category, actions]) =>
    actions.map((action) => [action, category as WebhookCategory] as const)
  )
)
