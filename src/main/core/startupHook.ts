import type { ChildProcess } from 'child_process'
import { existsSync, watch } from 'fs'
import type { FSWatcher } from 'fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { randomUUID } from 'crypto'
import { dataDir } from '../utils/dirs'

const coreHookTimeout = 30000

export interface CoreStartupHook {
  hookDir: string
  upFile: string
  upFileName: string
  postUpCommand: string
  postDownCommand: string
}

export interface CoreHookWaiter {
  promise: Promise<void>
  attachProcess: (process: ChildProcess) => void
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`
}

function hookTouchCommand(file: string): string {
  return process.platform === 'win32' ? `type nul > ${file}` : `: > ${shellQuote(file)}`
}

function coreHookDir(): string {
  if (process.platform === 'win32' && process.env.ProgramData) {
    return path.join(process.env.ProgramData, 'sparkle', 'core-hooks')
  }
  return path.join(dataDir(), 'core-hooks')
}

export async function createCoreStartupHook(): Promise<CoreStartupHook> {
  const runId = randomUUID()
  let hookDir = path.join(coreHookDir(), runId)

  try {
    await mkdir(hookDir, { recursive: true })
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    if (process.platform !== 'win32' || (code !== 'EACCES' && code !== 'EPERM')) {
      throw error
    }
    hookDir = path.join(dataDir(), 'core-hooks', runId)
    await mkdir(hookDir, { recursive: true })
  }

  const upFileName = `${runId}.up`
  const downFileName = `${runId}.down`
  const upFile = path.join(hookDir, upFileName)
  const downFile = path.join(hookDir, downFileName)

  return {
    hookDir,
    upFile,
    upFileName,
    postUpCommand: hookTouchCommand(upFile),
    postDownCommand: hookTouchCommand(downFile)
  }
}

export function createCoreHookWaiter(hook: CoreStartupHook): CoreHookWaiter {
  let watcher: FSWatcher | undefined
  let timer: NodeJS.Timeout | undefined
  let attachedProcess: ChildProcess | undefined
  let completed = false

  let resolvePromise: () => void
  let rejectPromise: (reason?: unknown) => void

  const cleanup = (): void => {
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    if (watcher) {
      watcher.close()
      watcher = undefined
    }
    if (attachedProcess) {
      attachedProcess.off('close', handleClose)
      attachedProcess = undefined
    }
  }

  const complete = (error?: unknown): void => {
    if (completed) return
    completed = true
    cleanup()
    if (error) {
      rejectPromise(error)
    } else {
      resolvePromise()
    }
  }

  const handleClose = (code: number | null, signal: NodeJS.Signals | null): void => {
    complete(new Error(`内核启动失败，post-up 未触发，code: ${code}, signal: ${signal}`))
  }

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject

    watcher = watch(hook.hookDir, (_eventType, filename) => {
      const changedFile = filename?.toString()
      if (changedFile === hook.upFileName || (!changedFile && existsSync(hook.upFile))) {
        complete()
      }
    })

    watcher.on('error', complete)

    timer = setTimeout(() => {
      complete(new Error(`等待内核 post-up 超时：${coreHookTimeout}ms`))
    }, coreHookTimeout)
  })

  return {
    promise,
    attachProcess: (process) => {
      attachedProcess = process
      attachedProcess.once('close', handleClose)
    }
  }
}
