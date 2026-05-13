import { toast, type ButtonProps } from '@heroui-v3/react'
import { getAppConfig } from './ipc'

type AppNotificationVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

export interface AppNotificationPayload {
  title: string
  body?: string
  variant?: AppNotificationVariant
  actionProps?: ButtonProps
  timeout?: number
  onClose?: () => void
}

interface AppNotificationOptions extends Omit<AppNotificationPayload, 'title'> {
  forceToast?: boolean
}

export function notify(title: unknown, options: AppNotificationOptions = {}): void {
  const { forceToast = false, ...payload } = options
  void showNotification({ ...payload, title: formatNotificationText(title) }, forceToast)
}

export function showToastNotification(payload: AppNotificationPayload): void {
  const { title, body } = normalizeToastPayload(payload)
  toast(title, {
    actionProps: payload.actionProps,
    description: body,
    onClose: payload.onClose,
    timeout: payload.timeout,
    variant: payload.variant ?? 'default'
  })
}

async function showNotification(
  payload: AppNotificationPayload,
  forceToast: boolean
): Promise<void> {
  if (forceToast) {
    showToastNotification(payload)
    return
  }

  try {
    const { notificationMode = 'system' } = await getAppConfig()
    if (notificationMode === 'toast') {
      showToastNotification(payload)
      return
    }
  } catch {
    // fall back to the current system notification behavior
  }

  const notification = new window.Notification(payload.title, { body: payload.body })
  notification.onclose = payload.onClose ?? null
}

function normalizeToastPayload(payload: AppNotificationPayload): { title: string; body?: string } {
  const title = formatNotificationText(payload.title)
  const body = payload.body ? formatNotificationText(payload.body) : undefined

  if (body || !title.includes('\n')) {
    return { title, body }
  }

  const [firstLine, ...bodyLines] = title.split('\n')
  return { title: firstLine, body: bodyLines.join('\n') || undefined }
}

function formatNotificationText(value: unknown): string {
  let text = value instanceof Error ? value.message : String(value)
  text = text.replace(/\\r\\n|\\n|\\r/g, '\n').replace(/\r\n|\r/g, '\n')
  text = text.replace(/^Error:\s*/i, '')
  return text.trim()
}
