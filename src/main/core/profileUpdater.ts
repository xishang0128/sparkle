import { getProfileConfig, refreshProfileItem } from '../config/profile'
import { appendAppLog } from '../utils/log'
import { isValidProfileInterval } from '../utils/profileInterval'

interface ProfileUpdateTask {
  item: ProfileItem
  timer?: NodeJS.Timeout
}

const tasks = new Map<string, ProfileUpdateTask>()
const runningTasks = new Map<string, ProfileUpdateTask>()
const minuteMs = 60 * 1000

function getIntervalMs(item: ProfileItem): number | undefined {
  if (
    item.type !== 'remote' ||
    item.autoUpdate === false ||
    !isValidProfileInterval(item.interval)
  ) {
    return undefined
  }
  return item.interval * minuteMs
}

function scheduleUpdate(task: ProfileUpdateTask, delayMs: number): void {
  task.timer = setTimeout(() => runUpdate(task), delayMs)
}

async function runUpdate(task: ProfileUpdateTask): Promise<void> {
  const { id } = task.item
  if (tasks.get(id) !== task) return
  task.timer = undefined
  if (runningTasks.has(id)) return
  runningTasks.set(id, task)
  try {
    task.item = await refreshProfileItem(task.item)
  } catch {
    try {
      await appendAppLog(
        `[Profile]: automatic update failed for ${id}; retrying at next interval\n`
      )
    } catch (error) {
      console.error('Failed to log automatic profile update failure', error)
    }
  } finally {
    runningTasks.delete(id)
    if (tasks.get(id) === task) {
      const intervalMs = getIntervalMs(task.item)
      if (intervalMs === undefined) {
        tasks.delete(id)
      } else {
        // 从完成时刻安排下一次，失败也不能立即重试
        scheduleUpdate(task, intervalMs)
      }
    } else {
      const pendingTask = tasks.get(id)
      // 新任务已到期但等待旧请求退出；未到期的计时器保持原定时间
      if (pendingTask && pendingTask.timer === undefined) scheduleUpdate(pendingTask, 0)
    }
  }
}

export async function initProfileUpdater(): Promise<void> {
  const { items, current } = await getProfileConfig()
  for (const id of tasks.keys()) {
    if (!items.some((item) => item.id === id && getIntervalMs(item) !== undefined)) clearTask(id)
  }
  for (const item of items) {
    const intervalMs = getIntervalMs(item)
    if (intervalMs === undefined) continue
    const runningTask = runningTasks.get(item.id)
    if (runningTask && tasks.get(item.id) === runningTask) {
      continue
    }
    clearTask(item.id)
    const task = { item }
    tasks.set(item.id, task)
    const lastUpdated = Number.isFinite(item.updated) ? item.updated! : 0
    const remainingMs = Math.max(0, Math.min(intervalMs, intervalMs - (Date.now() - lastUpdated)))
    scheduleUpdate(task, Math.min(intervalMs, remainingMs + (item.id === current ? 10000 : 0)))
  }
}

export async function addProfileUpdater(item: ProfileItem): Promise<void> {
  const intervalMs = getIntervalMs(item)
  if (intervalMs === undefined) {
    clearTask(item.id)
    return
  }
  clearTask(item.id)
  const task = { item }
  tasks.set(item.id, task)
  scheduleUpdate(task, intervalMs)
}

function clearTask(id: string): void {
  const task = tasks.get(id)
  if (task?.timer) clearTimeout(task.timer)
  tasks.delete(id)
}

export async function delProfileUpdater(id: string): Promise<void> {
  clearTask(id)
}
