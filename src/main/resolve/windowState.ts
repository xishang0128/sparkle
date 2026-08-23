import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'

type WindowState = {
  x?: number
  y?: number
  width: number
  height: number
  displayBounds?: Rectangle
  isMaximized?: boolean
  isFullScreen?: boolean
}

type WindowStateOptions = {
  file: string
  defaultWidth: number
  defaultHeight: number
  saveSize?: boolean
  restoreWindowMode?: boolean
  waitForSavedDisplay?: boolean
}

type WindowStateManager = {
  state: WindowState
  attach: (win: BrowserWindow) => void
}

const SAVE_DELAY = 200
const DISPLAY_RESTORE_DELAY = 1000
const DISPLAY_RESTORE_ATTEMPTS = 10
const BOUNDS_KEYS = ['x', 'y', 'width', 'height'] as const

function isInteger(value: unknown): value is number {
  return Number.isInteger(value)
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0
}

function isRectangle(value: unknown): value is Rectangle {
  if (!value || typeof value !== 'object') return false
  const rectangle = value as Partial<Rectangle>
  return (
    isInteger(rectangle.x) &&
    isInteger(rectangle.y) &&
    isPositiveInteger(rectangle.width) &&
    isPositiveInteger(rectangle.height)
  )
}

function readWindowState(filePath: string, options: WindowStateOptions): WindowState | null {
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<WindowState>
    return {
      width: isPositiveInteger(parsed.width) ? parsed.width : options.defaultWidth,
      height: isPositiveInteger(parsed.height) ? parsed.height : options.defaultHeight,
      ...(isInteger(parsed.x) && isInteger(parsed.y) ? { x: parsed.x, y: parsed.y } : {}),
      ...(isRectangle(parsed.displayBounds) ? { displayBounds: parsed.displayBounds } : {}),
      ...(typeof parsed.isMaximized === 'boolean' ? { isMaximized: parsed.isMaximized } : {}),
      ...(typeof parsed.isFullScreen === 'boolean' ? { isFullScreen: parsed.isFullScreen } : {})
    }
  } catch {
    return null
  }
}

function writeWindowState(filePath: string, state: WindowState): void {
  try {
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, JSON.stringify(state))
  } catch {
    // Window state is best-effort and must not interrupt application shutdown.
  }
}

function hasDisplayBounds(bounds: Rectangle): boolean {
  return screen
    .getAllDisplays()
    .some((display) => BOUNDS_KEYS.every((key) => display.bounds[key] === bounds[key]))
}

function isVisibleOnAnyDisplay(state: WindowState): boolean {
  if (!isInteger(state.x) || !isInteger(state.y)) return false
  const { x, y, width, height } = state

  return screen.getAllDisplays().some(({ workArea }) => {
    return (
      x < workArea.x + workArea.width &&
      x + width > workArea.x &&
      y < workArea.y + workArea.height &&
      y + height > workArea.y
    )
  })
}

export function createWindowStateManager(options: WindowStateOptions): WindowStateManager {
  const filePath = join(app.getPath('userData'), options.file)
  const savedState = readWindowState(filePath, options)
  const initialState: WindowState = savedState ?? {
    width: options.defaultWidth,
    height: options.defaultHeight
  }
  const state = { ...initialState }
  const currentState = { ...initialState }

  if (!isVisibleOnAnyDisplay(state)) {
    delete state.x
    delete state.y
  }

  const shouldWaitForDisplay = Boolean(
    options.waitForSavedDisplay &&
    savedState?.displayBounds &&
    !hasDisplayBounds(savedState.displayBounds)
  )

  let win: BrowserWindow | null = null
  let canSave = !shouldWaitForDisplay
  let saveTimer: NodeJS.Timeout | null = null
  let restoreTimer: NodeJS.Timeout | null = null
  let restoreAttempts = 0

  function clearSaveTimer(): void {
    if (!saveTimer) return
    clearTimeout(saveTimer)
    saveTimer = null
  }

  function stopDisplayRestore(): void {
    if (restoreTimer) {
      clearInterval(restoreTimer)
      restoreTimer = null
    }
    screen.off('display-added', restoreSavedDisplay)
    screen.off('display-metrics-changed', restoreSavedDisplay)
  }

  function save(): void {
    clearSaveTimer()
    if (!canSave || !win || win.isDestroyed()) return

    try {
      const bounds = win.getBounds()
      const isNormal = !win.isMaximized() && !win.isMinimized() && !win.isFullScreen()

      if (isNormal) {
        currentState.x = bounds.x
        currentState.y = bounds.y
        if (options.saveSize !== false) {
          currentState.width = bounds.width
          currentState.height = bounds.height
        }
      }

      if (options.restoreWindowMode !== false) {
        currentState.isMaximized = win.isMaximized()
        currentState.isFullScreen = win.isFullScreen()
      }
      currentState.displayBounds = screen.getDisplayMatching(bounds).bounds
      writeWindowState(filePath, currentState)
    } catch {
      // The window may be destroyed while an event is being handled.
    }
  }

  function scheduleSave(): void {
    clearSaveTimer()
    saveTimer = setTimeout(save, SAVE_DELAY)
  }

  function restoreSavedDisplay(): void {
    if (!win || !savedState?.displayBounds || win.isDestroyed()) {
      canSave = true
      stopDisplayRestore()
      return
    }

    restoreAttempts += 1
    if (hasDisplayBounds(savedState.displayBounds)) {
      if (isInteger(savedState.x) && isInteger(savedState.y)) {
        win.setBounds({
          x: savedState.x,
          y: savedState.y,
          width: savedState.width,
          height: savedState.height
        })
      }
      if (savedState.isMaximized) win.maximize()
      if (savedState.isFullScreen) win.setFullScreen(true)
      canSave = true
      stopDisplayRestore()
      save()
    } else if (restoreAttempts >= DISPLAY_RESTORE_ATTEMPTS) {
      canSave = true
      stopDisplayRestore()
      save()
    }
  }

  function cleanup(): void {
    clearSaveTimer()
    stopDisplayRestore()
    if (!win) return

    win.off('resize', scheduleSave)
    win.off('move', scheduleSave)
    win.off('maximize', scheduleSave)
    win.off('unmaximize', scheduleSave)
    win.off('enter-full-screen', scheduleSave)
    win.off('leave-full-screen', scheduleSave)
    win.off('close', save)
    win.off('closed', cleanup)
    win.off('show', startDisplayRestore)
    win = null
  }

  function startDisplayRestore(): void {
    if (!shouldWaitForDisplay) return
    screen.on('display-added', restoreSavedDisplay)
    screen.on('display-metrics-changed', restoreSavedDisplay)
    restoreSavedDisplay()
    if (!canSave) {
      restoreTimer = setInterval(restoreSavedDisplay, DISPLAY_RESTORE_DELAY)
    }
  }

  function attach(browserWindow: BrowserWindow): void {
    win = browserWindow
    if (state.isMaximized && options.restoreWindowMode !== false) win.maximize()
    if (state.isFullScreen && options.restoreWindowMode !== false) win.setFullScreen(true)

    win.on('resize', scheduleSave)
    win.on('move', scheduleSave)
    win.on('maximize', scheduleSave)
    win.on('unmaximize', scheduleSave)
    win.on('enter-full-screen', scheduleSave)
    win.on('leave-full-screen', scheduleSave)
    win.on('close', save)
    win.on('closed', cleanup)
    win.once('show', startDisplayRestore)
  }

  return { state, attach }
}

export function createMainWindowStateManager(): WindowStateManager {
  return createWindowStateManager({
    file: 'window-state.json',
    defaultWidth: 800,
    defaultHeight: 700,
    waitForSavedDisplay: process.platform === 'win32'
  })
}
