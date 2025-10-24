import React, { useEffect, useState } from 'react'
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider
} from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  checkCorePermission,
  checkElevateTask,
  manualGrantCorePermition,
  revokeCorePermission
} from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'

interface Props {
  onChange: (open: boolean) => void
  onRevoke: () => Promise<void>
  onGrant: () => Promise<void>
}

const PermissionModal: React.FC<Props> = (props) => {
  const { onChange, onRevoke, onGrant } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [loading, setLoading] = useState<{ mihomo?: boolean; 'mihomo-alpha'?: boolean }>({})
  const [hasPermission, setHasPermission] = useState<
    { mihomo: boolean; 'mihomo-alpha': boolean } | boolean | null
  >(null)
  const isWindows = platform === 'win32'

  const checkPermissions = async (): Promise<void> => {
    try {
      const result = isWindows ? await checkElevateTask() : await checkCorePermission()
      setHasPermission(result)
    } catch {
      setHasPermission(isWindows ? false : { mihomo: false, 'mihomo-alpha': false })
    }
  }

  useEffect(() => {
    checkPermissions()
  }, [])

  const handleAction = async (action: () => Promise<void>): Promise<void> => {
    setLoading({ mihomo: true, 'mihomo-alpha': true })
    try {
      await action()
      onChange(false)
    } catch (e) {
      // 忽略用户取消操作的错误
      const errorMsg = String(e)
      if (errorMsg.includes('用户取消操作') || errorMsg.includes('UserCancelledError')) {
        // 静默失败，只刷新状态
        await checkPermissions()
        return
      }
      alert(e)
    } finally {
      setLoading({})
    }
  }

  const handleCoreAction = async (
    coreName: 'mihomo' | 'mihomo-alpha',
    isGrant: boolean
  ): Promise<void> => {
    setLoading({ ...loading, [coreName]: true })
    try {
      if (isGrant) {
        await manualGrantCorePermition([coreName])
      } else {
        await revokeCorePermission([coreName])
      }
      await checkPermissions()
    } catch (e) {
      // 忽略用户取消操作的错误
      const errorMsg = String(e)
      if (errorMsg.includes('用户取消操作') || errorMsg.includes('UserCancelledError')) {
        // 静默失败，只刷新状态
        await checkPermissions()
        return
      }
      alert(e)
    } finally {
      setLoading({ ...loading, [coreName]: false })
    }
  }

  const getStatusText = (coreName: 'mihomo' | 'mihomo-alpha'): string => {
    if (hasPermission === null) return '检查中'
    if (typeof hasPermission === 'boolean') return hasPermission ? '已授权' : '未授权'
    return hasPermission[coreName] ? '已授权' : '未授权'
  }

  const getStatusColor = (coreName: 'mihomo' | 'mihomo-alpha'): string => {
    if (hasPermission === null) return 'bg-default-400 animate-pulse'
    if (typeof hasPermission === 'boolean') {
      return hasPermission ? 'bg-success' : 'bg-warning'
    }
    return hasPermission[coreName] ? 'bg-success' : 'bg-warning'
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
            {isWindows ? (
              <>
                <Card
                  shadow="sm"
                  className="border-none bg-gradient-to-br from-default-50 to-default-100"
                >
                  <CardBody className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">任务计划状态</span>
                      </div>
                      <Chip
                        color={
                          typeof hasPermission === 'boolean'
                            ? hasPermission
                              ? 'success'
                              : 'warning'
                            : 'default'
                        }
                        variant="flat"
                        size="sm"
                      >
                        {hasPermission === null
                          ? '检查中...'
                          : typeof hasPermission === 'boolean'
                            ? hasPermission
                              ? '已注册'
                              : '未注册'
                            : '未知'}
                      </Chip>
                    </div>
                  </CardBody>
                </Card>

                <Divider />

                <div className="text-xs text-default-500 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>任务计划将以特权拉起客户端自身</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>可以让内核以管理员权限运行，无需每次 UAC 提示</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">•</span>
                    <span>取消注册后可能需要手动提权才能使用某些功能</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <Card shadow="sm" className="border-none">
                    <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-medium">内置正式版</h4>
                        </div>
                        <Chip
                          color={getStatusColor('mihomo') === 'bg-success' ? 'success' : 'warning'}
                          variant="flat"
                          size="sm"
                        >
                          {getStatusText('mihomo')}
                        </Chip>
                      </div>
                    </CardHeader>
                    <CardBody className="pt-3 px-4 pb-4">
                      {typeof hasPermission !== 'boolean' && hasPermission?.mihomo ? (
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          onPress={() => handleCoreAction('mihomo', false)}
                          isLoading={loading.mihomo}
                          fullWidth
                        >
                          撤销授权
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          variant="shadow"
                          onPress={() => handleCoreAction('mihomo', true)}
                          isLoading={loading.mihomo}
                          fullWidth
                        >
                          授权内核
                        </Button>
                      )}
                    </CardBody>
                  </Card>

                  <Card shadow="sm" className="border-none">
                    <CardHeader className="pb-0 pt-4 px-4 flex-col items-start">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-medium">内置预览版</h4>
                        </div>
                        <Chip
                          color={
                            getStatusColor('mihomo-alpha') === 'bg-success' ? 'success' : 'warning'
                          }
                          variant="flat"
                          size="sm"
                        >
                          {getStatusText('mihomo-alpha')}
                        </Chip>
                      </div>
                    </CardHeader>
                    <CardBody className="pt-3 px-4 pb-4">
                      {typeof hasPermission !== 'boolean' && hasPermission?.['mihomo-alpha'] ? (
                        <Button
                          size="sm"
                          color="warning"
                          variant="flat"
                          onPress={() => handleCoreAction('mihomo-alpha', false)}
                          isLoading={loading['mihomo-alpha']}
                          fullWidth
                        >
                          撤销授权
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          color="primary"
                          variant="shadow"
                          onPress={() => handleCoreAction('mihomo-alpha', true)}
                          isLoading={loading['mihomo-alpha']}
                          fullWidth
                        >
                          授权内核
                        </Button>
                      )}
                    </CardBody>
                  </Card>
                </div>

                <div className="text-xs text-default-500 space-y-2">
                  <div className="flex items-start gap-2">
                    <span>授权后内核将获得必要的系统权限</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>可以使用 TUN 等高级网络功能</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </ModalBody>
        <ModalFooter className="space-x-2">
          <Button
            size="sm"
            variant="light"
            onPress={() => onChange(false)}
            isDisabled={Object.values(loading).some((v) => v)}
          >
            关闭
          </Button>
          {isWindows &&
            (() => {
              const hasAnyPermission = typeof hasPermission === 'boolean' ? hasPermission : false
              const isLoading = Object.values(loading).some((v) => v)

              return hasAnyPermission ? (
                <Button
                  size="sm"
                  color="warning"
                  onPress={() => handleAction(onRevoke)}
                  isLoading={isLoading}
                >
                  取消注册
                </Button>
              ) : (
                <Button
                  size="sm"
                  color="primary"
                  onPress={() => handleAction(onGrant)}
                  isLoading={isLoading}
                >
                  注册计划
                </Button>
              )
            })()}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PermissionModal
