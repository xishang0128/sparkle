import React, { useEffect, useState } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { checkCorePermission, checkElevateTask } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'

interface Props {
  onChange: (open: boolean) => void
  onRevoke: () => Promise<void>
  onGrant: () => Promise<void>
}

const isWindows = platform === 'win32'

const PermissionModal: React.FC<Props> = (props) => {
  const { onChange, onRevoke, onGrant } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [loading, setLoading] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)

  useEffect(() => {
    const checkPermission = async (): Promise<void> => {
      try {
        const result = isWindows ? await checkElevateTask() : await checkCorePermission()
        setHasPermission(result)
      } catch {
        setHasPermission(false)
      }
    }
    checkPermission()
  }, [])

  const handleAction = async (action: () => Promise<void>): Promise<void> => {
    setLoading(true)
    try {
      await action()
      onChange(false)
    } catch (e) {
      alert(e)
    } finally {
      setLoading(false)
    }
  }

  const getStatusText = (): string => {
    if (hasPermission === null) return '检查中'
    return hasPermission ? (isWindows ? '已注册' : '已授权') : isWindows ? '未注册' : '未授权'
  }

  const getStatusColor = (): string => {
    if (hasPermission === null) return 'bg-default-400 animate-pulse'
    return hasPermission ? 'bg-success' : 'bg-warning'
  }

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      hideCloseButton
      isOpen={true}
      size="5xl"
      onOpenChange={onChange}
      scrollBehavior="inside"
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
    >
      <ModalContent className="w-[450px]">
        <ModalHeader className="flex flex-col gap-1">
          {isWindows ? '任务计划管理' : '内核授权管理'}
        </ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-default-50">
              <span className="text-sm font-medium">当前状态</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-default-100">
                <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                <span className="text-sm font-medium">{getStatusText()}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-default-600">
                <p className="mb-2">{isWindows ? '任务计划说明：' : '授权说明：'}</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  {isWindows ? (
                    <>
                      <li>任务计划将以特权拉起客户端自身</li>
                      <li>可以让内核以管理员权限运行，无需每次 UAC 提示</li>
                      <li>取消注册后可能需要手动提权才能使用某些功能</li>
                    </>
                  ) : (
                    <>
                      <li>授权后内核将获得必要的系统权限</li>
                      <li>可以使用 TUN 等高级功能</li>
                      <li>撤销授权后部分功能可能无法正常工作</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter className="space-x-2">
          <Button size="sm" variant="light" onPress={() => onChange(false)} isDisabled={loading}>
            关闭
          </Button>
          {hasPermission ? (
            <Button
              size="sm"
              color="warning"
              onPress={() => handleAction(onRevoke)}
              isLoading={loading}
            >
              {isWindows ? '取消注册' : '撤销授权'}
            </Button>
          ) : (
            <Button
              size="sm"
              color="primary"
              onPress={() => handleAction(onGrant)}
              isLoading={loading}
            >
              {isWindows ? '注册计划' : '授权内核'}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PermissionModal
