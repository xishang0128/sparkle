import { toast, type ButtonProps } from '@heroui-v3/react'
import { getAppConfig } from './ipc'

type AppNotificationVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

export interface AppNotificationPayload {
  id?: string
  title: string
  body?: string
  persistent?: boolean
  url?: string
  variant?: AppNotificationVariant
  actionProps?: ButtonProps
  timeout?: number
  onClose?: () => void
}

const toastKeys = new Map<string, string>()

interface AppNotificationOptions extends Omit<AppNotificationPayload, 'title'> {
  forceToast?: boolean
}

export function notify(title: unknown, options: AppNotificationOptions = {}): void {
  const { forceToast = false, ...payload } = options
  void showNotification({ ...payload, title: formatNotificationText(title) }, forceToast)
}

export function showToastNotification(payload: AppNotificationPayload): void {
  const { title, body } = normalizeToastPayload(payload)
  if (payload.id) {
    const previousKey = toastKeys.get(payload.id)
    if (previousKey) {
      toast.close(previousKey)
      toastKeys.delete(payload.id)
    }
  }

  let key = ''
  key = toast(title, {
    actionProps:
      payload.actionProps ??
      (payload.url
        ? {
            children: '打开',
            onPress: () => window.open(payload.url, '_blank', 'noopener,noreferrer')
          }
        : undefined),
    description: body,
    onClose: () => {
      if (payload.id && toastKeys.get(payload.id) === key) {
        toastKeys.delete(payload.id)
      }
      payload.onClose?.()
    },
    timeout: payload.persistent ? 0 : payload.timeout,
    variant: payload.variant ?? 'default'
  })
  if (payload.id) {
    toastKeys.set(payload.id, key)
  }
}

export function dismissToastNotification(id: string): void {
  const key = toastKeys.get(id)
  if (!key) return

  toast.close(key)
  toastKeys.delete(id)
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

  const notification = new window.Notification(payload.title, {
    body: payload.body,
    requireInteraction: payload.persistent
  })
  notification.onclick = payload.url
    ? () => {
        window.open(payload.url, '_blank', 'noopener,noreferrer')
        notification.close()
      }
    : null
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
