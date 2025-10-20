import React, { useEffect } from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { checkCorePermission } from '@renderer/utils/ipc'

interface Props {
  onChange: (open: boolean) => void
  onRevoke: () => Promise<void>
  onGrant: () => Promise<void>
}

const PermissionModal: React.FC<Props> = (props) => {
  const { onChange, onRevoke, onGrant } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [loading, setLoading] = React.useState(false)
  const [hasPermission, setHasPermission] = React.useState<boolean | null>(null)

  useEffect(() => {
    const checkPermission = async (): Promise<void> => {
      try {
        const hasSuid = await checkCorePermission()
        setHasPermission(hasSuid)
      } catch {
        setHasPermission(false)
      }
    }
    checkPermission()
  }, [])

  const handleAction = async (action: () => Promise<void>): Promise<void> => {
    try {
      setLoading(true)
      await action()
      onChange(false)
    } catch (e) {
      alert(e)
    } finally {
      setLoading(false)
    }
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
        <ModalHeader className="flex flex-col gap-1">内核授权管理</ModalHeader>
        <ModalBody>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-default-50">
              <span className="text-sm font-medium">当前状态</span>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-default-100">
                <div
                  className={`w-2 h-2 rounded-full ${
                    hasPermission === null
                      ? 'bg-default-400 animate-pulse'
                      : hasPermission
                        ? 'bg-success'
                        : 'bg-warning'
                  }`}
                />
                <span className="text-sm font-medium">
                  {hasPermission === null ? '检查中' : hasPermission ? '已授权' : '未授权'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-default-600">
                <p className="mb-2">授权说明：</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>授权后内核将获得必要的系统权限</li>
                  <li>可以使用虚拟网卡、TUN 等高级功能</li>
                  <li>撤销授权后部分功能可能无法正常工作</li>
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
              撤销授权
            </Button>
          ) : (
            <Button
              size="sm"
              color="primary"
              onPress={() => handleAction(onGrant)}
              isLoading={loading}
            >
              授权内核
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PermissionModal
