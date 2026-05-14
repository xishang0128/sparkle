import { BrowserWindow, Notification, ipcMain, shell } from 'electron'
import { getAppConfig } from '../config/app'

export type AppNotificationVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'
type AppNotificationMode = 'system' | 'toast'

export interface AppNotificationPayload {
  title: string
  body?: string
  persistent?: boolean
  url?: string
  variant?: AppNotificationVariant
}

const pendingToastNotifications: AppNotificationPayload[] = []

ipcMain.on('app-notification-ready', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender)
  if (!window || !isMainRendererWindow(window)) {
    return
  }

  flushPendingToastNotifications(window)
})

export async function showNotification(payload: AppNotificationPayload): Promise<void> {
  const notification = normalizeNotificationPayload(payload)
  let notificationMode: AppNotificationMode = 'system'
  try {
    notificationMode = (await getAppConfig()).notificationMode ?? 'system'
  } catch {
    // fall back to system notifications when config is not readable yet
  }

  if (notificationMode === 'toast') {
    const window = getVisibleMainRendererWindow()
    if (window) {
      window.webContents.send('app-notification', notification)
      return
    }

    pendingToastNotifications.push(notification)
    return
  }

  const systemNotification = new Notification({
    title: notification.title,
    body: notification.body,
    timeoutType: notification.persistent ? 'never' : 'default'
  })
  if (notification.url) {
    systemNotification.on('click', () => {
      void shell.openExternal(notification.url!)
    })
  }
  systemNotification.show()
}

function getVisibleMainRendererWindow(): BrowserWindow | undefined {
  return BrowserWindow.getAllWindows().find(
    (window) =>
      !window.isDestroyed() &&
      window.isVisible() &&
      !window.isMinimized() &&
      isMainRendererWindow(window)
  )
}

function flushPendingToastNotifications(window: BrowserWindow): void {
  if (pendingToastNotifications.length === 0) {
    return
  }

  const notifications = pendingToastNotifications.splice(0)
  for (const notification of notifications) {
    window.webContents.send('app-notification', notification)
  }
}

function isMainRendererWindow(window: BrowserWindow): boolean {
  const url = window.webContents.getURL()
  return !url.includes('floating.html') && !url.includes('traymenu.html')
}

function normalizeNotificationPayload(payload: AppNotificationPayload): AppNotificationPayload {
  return {
    ...payload,
    title: formatNotificationText(payload.title),
    body: payload.body ? formatNotificationText(payload.body) : undefined,
    persistent: payload.persistent,
    url: payload.url ? formatNotificationText(payload.url) : undefined
  }
}

function formatNotificationText(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value)
  text = text.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\r\n|\r/g, '\n')
  text = text.replace(/^Error:\s*/i, '')
  return text.trim()
}
