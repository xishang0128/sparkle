import { clearCachedMihomoLogs, getCachedMihomoLogs } from './ipc'

export type MihomoLogEntry = ControllerLog & { id: string; seq?: number }

type MihomoIncomingLog = ControllerLog & { id?: string; seq?: number }
type MihomoLogListener = (logs: MihomoLogEntry[]) => void

const listeners = new Set<MihomoLogListener>()

let logs: MihomoLogEntry[] = []
let maxEntries = 500
let initialized = false
let nextLogId = 0
let pendingLogs: MihomoIncomingLog[] = []
let flushTimer: number | null = null
const flushIntervalMs = 32

function trimLogs(nextLogs: MihomoLogEntry[]): MihomoLogEntry[] {
  if (nextLogs.length <= maxEntries) return nextLogs
  return nextLogs.slice(nextLogs.length - maxEntries)
}

function notify(): void {
  const snapshot = [...logs]
  listeners.forEach((listener) => listener(snapshot))
}

function flushPendingLogs(): void {
  flushTimer = null
  if (pendingLogs.length === 0) return

  logs = mergeLogs(logs, pendingLogs)
  pendingLogs = []
  notify()
}

function scheduleFlush(): void {
  if (flushTimer) return
  flushTimer = window.setTimeout(() => {
    flushPendingLogs()
  }, flushIntervalMs)
}

function createLogId(log: MihomoIncomingLog): string {
  if (log.id) return log.id
  if (typeof log.seq === 'number') return `seq:${log.seq}`

  nextLogId += 1
  return `log:${nextLogId}`
}

function normalizeLog(log: MihomoIncomingLog): MihomoLogEntry {
  if (log.id && log.time) return log as MihomoLogEntry

  return {
    ...log,
    id: createLogId(log),
    time: log.time || new Date().toLocaleString()
  }
}

function isSameLog(left: MihomoLogEntry, right: MihomoLogEntry): boolean {
  return (
    left.id === right.id &&
    left.seq === right.seq &&
    left.type === right.type &&
    left.payload === right.payload &&
    left.time === right.time
  )
}

function mergeLogs(current: MihomoLogEntry[], incoming: MihomoIncomingLog[]): MihomoLogEntry[] {
  const withSeq = new Map<number, MihomoLogEntry>()
  const withoutSeq = new Map<string, MihomoLogEntry>()

  current.forEach((log) => {
    if (typeof log.seq === 'number') {
      withSeq.set(log.seq, log)
      return
    }

    withoutSeq.set(log.id, log)
  })

  incoming.forEach((log) => {
    const normalized = normalizeLog(log)
    if (typeof normalized.seq !== 'number') {
      const existing = withoutSeq.get(normalized.id)
      withoutSeq.set(
        normalized.id,
        existing && isSameLog(existing, normalized) ? existing : normalized
      )
      return
    }

    const existing = withSeq.get(normalized.seq)
    withSeq.set(normalized.seq, existing && isSameLog(existing, normalized) ? existing : normalized)
  })

  const merged = [
    ...Array.from(withSeq.values()).sort((a, b) => (a.seq || 0) - (b.seq || 0)),
    ...Array.from(withoutSeq.values())
  ]

  return trimLogs(merged)
}

function initLogStore(): void {
  if (initialized) return

  initialized = true
  window.electron.ipcRenderer.on('mihomoLogs', (_event, log: MihomoIncomingLog) => {
    pendingLogs.push(log)
    scheduleFlush()
  })

  void getCachedMihomoLogs()
    .then((history) => {
      logs = mergeLogs(logs, history)
      notify()
    })
    .catch(() => {
      // ignore
    })
}

export function getMihomoLogs(): MihomoLogEntry[] {
  initLogStore()
  return [...logs]
}

export function subscribeMihomoLogs(listener: MihomoLogListener): () => void {
  initLogStore()
  listeners.add(listener)
  listener([...logs])

  return () => {
    listeners.delete(listener)
  }
}

export function clearMihomoLogs(): void {
  if (flushTimer) {
    window.clearTimeout(flushTimer)
    flushTimer = null
  }
  pendingLogs = []
  logs = []
  notify()
  void clearCachedMihomoLogs()
}

export function setMihomoLogMaxEntries(value: number): void {
  const nextValue = Math.max(1, Math.floor(value) || 1)
  if (nextValue === maxEntries) return

  maxEntries = nextValue
  const trimmedLogs = trimLogs(logs)
  if (trimmedLogs.length === logs.length) return

  logs = trimmedLogs
  notify()
}

initLogStore()
