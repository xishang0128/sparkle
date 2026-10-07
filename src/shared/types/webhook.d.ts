type WebhookCategory =
  | 'lifecycle'
  | 'network'
  | 'profiles'
  | 'connections'
  | 'settings'
  | 'service'
  | 'tools'
  | 'application'

interface WebhookConfig {
  targets?: WebhookTarget[]
}

interface WebhookTarget {
  id: string
  enabled?: boolean
  url?: string
  name?: string
  token?: string
  timeout?: number
  categories?: WebhookCategory[]
}

interface WebhookEvent {
  schemaVersion: 1
  id: string
  sessionId: string
  sequence: number
  timestamp: string
  name: string
  version: string
  platform: string
  category: WebhookCategory
  action: string
  status: 'success' | 'failure'
  source: 'ipc' | 'tray' | 'shortcut' | 'core' | 'config'
  data: Record<string, unknown>
}
