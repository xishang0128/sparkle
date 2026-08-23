type InitialContentPart = 'route' | 'sider'

const readyParts = new Set<InitialContentPart>()
const contentReadyListeners = new Set<() => void>()
let contentReady = false

export function onInitialContentReady(listener: () => void): () => void {
  if (contentReady) {
    listener()
    return (): void => {}
  }

  contentReadyListeners.add(listener)
  return (): void => {
    contentReadyListeners.delete(listener)
  }
}

export function markInitialContentPartReady(part: InitialContentPart): void {
  readyParts.add(part)
  if (readyParts.size < 2 || contentReady) return

  contentReady = true
  window.electron.ipcRenderer.send('renderer-content-ready')
  contentReadyListeners.forEach((listener) => listener())
  contentReadyListeners.clear()
}
