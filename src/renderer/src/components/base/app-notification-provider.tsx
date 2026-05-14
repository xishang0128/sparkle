import { Toast } from '@heroui-v3/react'
import { useEffect } from 'react'
import { dismissToastNotification, showToastNotification } from '@renderer/utils/notification'

const maxVisibleAppNotifications = 10

const AppNotificationProvider: React.FC = () => {
  useEffect(() => {
    const handleNotification = (
      _event: Electron.IpcRendererEvent,
      payload: Parameters<typeof showToastNotification>[0]
    ): void => {
      showToastNotification(payload)
    }
    const handleNotificationDismiss = (_event: Electron.IpcRendererEvent, id: string): void => {
      dismissToastNotification(id)
    }

    window.electron.ipcRenderer.on('app-notification', handleNotification)
    window.electron.ipcRenderer.on('app-notification-dismiss', handleNotificationDismiss)
    window.electron.ipcRenderer.send('app-notification-ready')
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('app-notification')
      window.electron.ipcRenderer.removeAllListeners('app-notification-dismiss')
    }
  }, [])

  return (
    <Toast.Provider
      className="app-nodrag top-14 right-4"
      maxVisibleToasts={maxVisibleAppNotifications}
      placement="top end"
    />
  )
}

export default AppNotificationProvider
