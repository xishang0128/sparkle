import { Chip, Card, Separator, Button, Spinner, Modal } from '@heroui/react'

import React, { useEffect, useState } from 'react'

import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  checkCorePermission,
  checkElevateTask,
  manualGrantCorePermition,
  revokeCorePermission
} from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { notify } from '@renderer/utils/notification'

interface Props {
  onChange: (open: boolean) => void
  onRevoke: () => Promise<void>
  onGrant: () => Promise<void>
}

const PermissionModal: React.FC<Props> = (props) => {
  const { onChange, onRevoke, onGrant } = props
  useAppConfig()
  const [loading, setLoading] = useState<{
    mihomo?: boolean
    'mihomo-alpha'?: boolean
  }>({})
  const [hasPermission, setHasPermission] = useState<
    | {
        mihomo: boolean
        'mihomo-alpha': boolean
      }
    | boolean
    | null
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
      notify(e, { variant: 'danger' })
    } finally {
      setLoading({})
    }
  }

  const handleCoreAction = async (
    coreName: 'mihomo' | 'mihomo-alpha',
    isGrant: boolean
  ): Promise<void> => {
    setLoading((prev) => ({ ...prev, [coreName]: true }))
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
      notify(e, { variant: 'danger' })
    } finally {
      setLoading((prev) => ({ ...prev, [coreName]: false }))
    }
  }

  const getStatusText = (coreName: 'mihomo' | 'mihomo-alpha'): string => {
    if (hasPermission === null) return '检查中'
    if (typeof hasPermission === 'boolean') return hasPermission ? '已授权' : '未授权'
    return hasPermission[coreName] ? '已授权' : '未授权'
  }

  const getStatusColor = (
    coreName: 'mihomo' | 'mihomo-alpha'
  ): 'success' | 'warning' | 'default' => {
    if (hasPermission === null) return 'default'
    if (typeof hasPermission === 'boolean') {
      return hasPermission ? 'success' : 'warning'
    }
    return hasPermission[coreName] ? 'success' : 'warning'
  }

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onChange}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-112.5">
            <Modal.Header className="flex-col gap-1">
              <Modal.Heading>提权状态管理</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                {isWindows ? (
                  <>
                    <Card className="border border-default-200 bg-surface" data-shadow="sm">
                      <Card.Content className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">提权配置状态</span>
                          </div>
                          <Chip
                            size="sm"
                            data-color={
                              typeof hasPermission === 'boolean'
                                ? hasPermission
                                  ? 'success'
                                  : 'warning'
                                : 'default'
                            }
                            variant="soft"
                          >
                            <Chip.Label>
                              {hasPermission === null
                                ? '检查中...'
                                : typeof hasPermission === 'boolean'
                                  ? hasPermission
                                    ? '已配置'
                                    : '未配置'
                                  : '未知'}
                            </Chip.Label>
                          </Chip>
                        </div>
                      </Card.Content>
                    </Card>

                    <Separator />

                    <div className="text-xs text-default-500 space-y-2">
                      <div>提权配置会让直接运行模式具备必要的系统权限</div>
                      <div>可以让内核以管理员权限运行，无需每次 UAC 提示</div>
                      <div>取消注册后可能需要手动提权才能使用某些功能</div>
                    </div>
                  </>
                ) : (
                  <>
                    <Card className="border border-default-200 bg-surface" data-shadow="sm">
                      <Card.Content className="space-y-3 py-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">内置正式版</span>
                            <Chip size="sm" data-color={getStatusColor('mihomo')} variant="soft">
                              <Chip.Label>{getStatusText('mihomo')}</Chip.Label>
                            </Chip>
                          </div>
                          {typeof hasPermission !== 'boolean' && hasPermission?.mihomo ? (
                            <Button
                              size="sm"
                              onPress={() => handleCoreAction('mihomo', false)}
                              fullWidth
                              variant="secondary"
                              data-color="warning"
                              isPending={loading.mihomo}
                              isDisabled={loading.mihomo}
                            >
                              {loading.mihomo ? <Spinner size="sm" color="current" /> : null}
                              撤销授权
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onPress={() => handleCoreAction('mihomo', true)}
                              fullWidth
                              variant="primary"
                              data-color="primary"
                              data-shadow="true"
                              isPending={loading.mihomo}
                              isDisabled={loading.mihomo}
                            >
                              {loading.mihomo ? <Spinner size="sm" color="current" /> : null}
                              授权内核
                            </Button>
                          )}
                        </div>
                        <Separator />
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">内置预览版</span>
                            <Chip
                              size="sm"
                              data-color={getStatusColor('mihomo-alpha')}
                              variant="soft"
                            >
                              <Chip.Label>{getStatusText('mihomo-alpha')}</Chip.Label>
                            </Chip>
                          </div>
                          {typeof hasPermission !== 'boolean' && hasPermission?.['mihomo-alpha'] ? (
                            <Button
                              size="sm"
                              onPress={() => handleCoreAction('mihomo-alpha', false)}
                              fullWidth
                              variant="secondary"
                              data-color="warning"
                              isPending={loading['mihomo-alpha']}
                              isDisabled={loading['mihomo-alpha']}
                            >
                              {loading['mihomo-alpha'] ? (
                                <Spinner size="sm" color="current" />
                              ) : null}
                              撤销授权
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onPress={() => handleCoreAction('mihomo-alpha', true)}
                              fullWidth
                              variant="primary"
                              data-color="primary"
                              data-shadow="true"
                              isPending={loading['mihomo-alpha']}
                              isDisabled={loading['mihomo-alpha']}
                            >
                              {loading['mihomo-alpha'] ? (
                                <Spinner size="sm" color="current" />
                              ) : null}
                              授权内核
                            </Button>
                          )}
                        </div>
                      </Card.Content>
                    </Card>

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
            </Modal.Body>
            <Modal.Footer className="flex-col gap-2 sm:flex-row">
              {isWindows &&
                (() => {
                  const hasAnyPermission =
                    typeof hasPermission === 'boolean' ? hasPermission : false
                  const isLoading = Object.values(loading).some((v) => v)

                  return hasAnyPermission ? (
                    <Button
                      size="sm"
                      onPress={() => handleAction(onRevoke)}
                      variant="primary"
                      data-color="warning"
                      className="min-w-20"
                      isPending={isLoading}
                      isDisabled={isLoading}
                    >
                      {isLoading ? <Spinner size="sm" color="current" /> : null}取消提权
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onPress={() => handleAction(onGrant)}
                      variant="primary"
                      data-color="primary"
                      className="min-w-20"
                      isPending={isLoading}
                      isDisabled={isLoading}
                    >
                      {isLoading ? <Spinner size="sm" color="current" /> : null}配置提权
                    </Button>
                  )
                })()}
            </Modal.Footer>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default PermissionModal
