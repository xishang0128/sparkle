import type { ChildProcess } from 'child_process'
import { appendAppLog } from '../utils/log'

function isProcessAlive(pid: number): boolean {
  try {
    globalThis.process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export async function stopChildProcess(process: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!process || process.exitCode !== null || process.signalCode !== null) {
      resolve()
      return
    }

    const pid = process.pid
    if (!pid) {
      resolve()
      return
    }

    process.removeAllListeners()

    let isResolved = false
    const timers: NodeJS.Timeout[] = []

    const resolveOnce = (): void => {
      if (!isResolved) {
        isResolved = true

        timers.forEach((timer) => clearTimeout(timer))
        resolve()
      }
    }

    process.once('close', resolveOnce)
    process.once('exit', resolveOnce)

    try {
      process.kill('SIGINT')
    } catch {
      // ignore
    }
    if (!isProcessAlive(pid)) {
      resolveOnce()
      return
    }

    const timer1 = setTimeout(() => {
      if (isResolved) return
      if (!isProcessAlive(pid)) {
        resolveOnce()
        return
      }
      try {
        process.kill('SIGTERM')
      } catch {
        // ignore
      }
    }, 3000)
    timers.push(timer1)

    const timer2 = setTimeout(() => {
      if (isResolved) return
      if (isProcessAlive(pid)) {
        try {
          process.kill('SIGKILL')
          appendAppLog(`[Manager]: Force killed process ${pid} with SIGKILL\n`).catch(() => {})
        } catch {
          // ignore
        }
      }
      resolveOnce()
    }, 6000)
    timers.push(timer2)
  })
}
