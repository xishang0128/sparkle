import { Button, Spinner } from '@heroui/react'

import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  subStoreFrontendPort,
  subStorePort,
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer,
  downloadSubStore
} from '@renderer/utils/ipc'
import React, { useEffect, useState } from 'react'
import { HiExternalLink } from 'react-icons/hi'
import { IoMdCloudDownload } from 'react-icons/io'
import { notify } from '@renderer/utils/notification'

const SubStore: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { useCustomSubStore, customSubStoreUrl } = appConfig || {}
  const [backendPort, setBackendPort] = useState<number | undefined>()
  const [frontendPort, setFrontendPort] = useState<number | undefined>()
  const [isUpdating, setIsUpdating] = useState(false)
  const getPort = async (): Promise<void> => {
    setBackendPort(await subStorePort())
    setFrontendPort(await subStoreFrontendPort())
  }
  useEffect(() => {
    getPort()
  }, [useCustomSubStore])

  if (!useCustomSubStore && !backendPort) return null
  if (!frontendPort) return null
  return (
    <>
      <BasePage
        title="Sub-Store"
        header={
          <div className="flex gap-2">
            <Button
              isIconOnly
              size="sm"
              onPress={async () => {
                try {
                  notify('Sub-Store 更新中...')
                  setIsUpdating(true)
                  await downloadSubStore()
                  await stopSubStoreBackendServer()
                  await startSubStoreBackendServer()
                  await new Promise((resolve) => {
                    setTimeout(resolve, 1000)
                  })
                  setFrontendPort(0)
                  await stopSubStoreFrontendServer()
                  await startSubStoreFrontendServer()
                  await getPort()
                  notify('Sub-Store 更新完成', { variant: 'success' })
                } catch (e) {
                  notify(`Sub-Store 更新失败：${e}`, { variant: 'danger' })
                } finally {
                  setIsUpdating(false)
                }
              }}
              variant="ghost"
              data-color="default"
              className="app-nodrag"
              isPending={isUpdating}
              isDisabled={isUpdating}
            >
              {isUpdating ? <Spinner size="sm" color="current" /> : null}
              <IoMdCloudDownload className="text-lg" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              onPress={() => {
                open(
                  `http://127.0.0.1:${frontendPort}?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${backendPort}`}`
                )
              }}
              variant="ghost"
              data-color="default"
              className="app-nodrag"
            >
              <HiExternalLink className="text-lg" />
            </Button>
          </div>
        }
      >
        <iframe
          className="w-full h-full"
          allow="clipboard-write; clipboard-read"
          src={`http://127.0.0.1:${frontendPort}?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${backendPort}`}`}
        />
      </BasePage>
    </>
  )
}

export default SubStore
