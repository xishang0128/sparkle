import { Button } from '@heroui/react'
import React, { useState, useEffect } from 'react'
import UpdaterDrawer from './updater-drawer'
import { GrUpgrade } from 'react-icons/gr'
import { cancelUpdate } from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'

let notifiedUpdateVersion = ''
let hiddenUpdateButtonVersion = ''

interface Props {
  iconOnly?: boolean
  latest?: {
    version: string
    changelog: string
  }
  showButtonAfterNotification?: boolean
}

const UpdaterButton: React.FC<Props> = (props) => {
  const { iconOnly, latest, showButtonAfterNotification = true } = props
  const [openDrawer, setOpenDrawer] = useState(false)
  const [drawerReopenSignal, setDrawerReopenSignal] = useState(0)
  const [showButton, setShowButton] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<{
    downloading: boolean
    progress: number
    error?: string
  }>({
    downloading: false,
    progress: 0
  })

  useEffect(() => {
    const handleUpdateStatus = (
      _: Electron.IpcRendererEvent,
      status: typeof updateStatus
    ): void => {
      setUpdateStatus(status)
    }

    const unsubscribe = window.electron.ipcRenderer.on('update-status', handleUpdateStatus)

    return (): void => {
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!latest) return

    if (hiddenUpdateButtonVersion === latest.version) {
      setShowButton(false)
      return
    }

    if (latest.version === notifiedUpdateVersion) {
      setShowButton(showButtonAfterNotification)
      return
    }

    notifiedUpdateVersion = latest.version
    hiddenUpdateButtonVersion = latest.version
    setShowButton(false)
    notify('发现新版本', {
      actionProps: {
        children: '查看内容',
        onPress: () => {
          setOpenDrawer(true)
          setDrawerReopenSignal((signal) => signal + 1)
        },
        variant: 'secondary'
      },
      body: `${latest.version} 版本就绪`,
      forceToast: true,
      onClose: () => {
        if (hiddenUpdateButtonVersion === latest.version) {
          hiddenUpdateButtonVersion = ''
        }
        setShowButton(showButtonAfterNotification)
      },
      timeout: 8000,
      variant: 'accent'
    })
  }, [latest, showButtonAfterNotification])

  const handleCancelUpdate = async (): Promise<void> => {
    try {
      await cancelUpdate()
      setUpdateStatus({ downloading: false, progress: 0 })
    } catch (e) {
      // ignore
    }
  }

  if (!latest) return null

  return (
    <>
      {openDrawer && (
        <UpdaterDrawer
          version={latest.version}
          changelog={latest.changelog}
          updateStatus={updateStatus}
          reopenSignal={drawerReopenSignal}
          onCancel={handleCancelUpdate}
          onClose={() => {
            setOpenDrawer(false)
          }}
        />
      )}
      {showButton && (
        <Button
          isIconOnly
          aria-label="查看更新"
          className={iconOnly ? 'app-nodrag' : 'fixed right-11.25 app-nodrag'}
          color="danger"
          size={iconOnly ? 'md' : 'sm'}
          onPress={() => {
            setOpenDrawer(true)
            setDrawerReopenSignal((signal) => signal + 1)
          }}
        >
          <GrUpgrade />
        </Button>
      )}
    </>
  )
}

export default UpdaterButton
