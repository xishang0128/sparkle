import { Chip, Spinner, Card, Separator, Button, Modal } from '@heroui/react'

import React, { useEffect, useState, useCallback } from 'react'

import { serviceStatus, testServiceConnection } from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'
import { systemCoreOnlyBuild, systemServicePath } from '../../../../shared/build-flags'

interface Props {
  onChange: (open: boolean) => void
  onInit: () => Promise<void>
  onInstall: () => Promise<void>
  onUninstall: () => Promise<void>
  onStart: () => Promise<void>
  onRestart: () => Promise<void>
}

type ServiceStatusType = Awaited<ReturnType<typeof serviceStatus>>
type ConnectionStatusType = 'connected' | 'disconnected' | 'checking' | 'unknown'

function isUserCancelledError(error: unknown): boolean {
  const errorMsg = String(error)
  return errorMsg.includes('用户取消操作') || errorMsg.includes('UserCancelledError')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function readServiceStatus(): Promise<ServiceStatusType> {
  try {
    return await serviceStatus()
  } catch {
    return 'not-installed'
  }
}

const ServiceModal: React.FC<Props> = (props) => {
  const { onChange, onInit, onInstall, onUninstall, onStart, onRestart } = props
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ServiceStatusType | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('checking')

  const refreshServiceStatus = useCallback(async (nextStatus?: ServiceStatusType) => {
    const result = nextStatus ?? (await readServiceStatus())
    setStatus(result)

    if (result !== 'running') {
      setConnectionStatus('disconnected')
      return result
    }

    setConnectionStatus('checking')
    const connected = await testServiceConnection().catch(() => false)
    setConnectionStatus(connected ? 'connected' : 'disconnected')
    return result
  }, [])

  const handleAction = async (
    action: () => Promise<void>,
    isStartAction = false
  ): Promise<void> => {
    setLoading(true)
    try {
      await action()

      await delay(500)

      let result = await readServiceStatus()

      if (isStartAction) {
        let retries = 5
        while (retries > 0 && result === 'stopped') {
          await delay(1000)
          result = await readServiceStatus()
          retries--
        }
      }

      await refreshServiceStatus(result)
    } catch (e) {
      await refreshServiceStatus()
      if (!isUserCancelledError(e)) notify(e, { variant: 'danger' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refreshServiceStatus()
  }, [refreshServiceStatus])

  const getStatusText = (): string => {
    if (status === null) return '检查中'
    switch (status) {
      case 'running':
        return '运行中'
      case 'stopped':
        return '已停止'
      case 'not-installed':
        return '未安装'
      case 'need-init':
        return '需要初始化'
      case 'paused':
        return '已暂停'
      default:
        return '未知状态'
    }
  }

  const getConnectionStatusText = (): string => {
    switch (connectionStatus) {
      case 'connected':
        return '已连接'
      case 'disconnected':
        return '未连接'
      case 'checking':
        return '检测中'
      default:
        return '未知'
    }
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
              <Modal.Heading>Sparkle 服务管理</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <Card
                  className="border-none bg-linear-to-br from-default-50 to-default-100"
                  data-shadow="sm"
                >
                  <Card.Content className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">服务状态</span>
                      </div>
                      {status === null ? (
                        <Chip size="sm" data-color="default" variant="soft">
                          {<Spinner size="sm" color="current" />}
                          <Chip.Label>检查中...</Chip.Label>
                        </Chip>
                      ) : (
                        <Chip
                          size="sm"
                          data-color={
                            status === 'running'
                              ? 'success'
                              : status === 'stopped'
                                ? 'warning'
                                : status === 'not-installed'
                                  ? 'danger'
                                  : status === 'need-init'
                                    ? 'warning'
                                    : 'default'
                          }
                          variant="soft"
                        >
                          <Chip.Label>{getStatusText()}</Chip.Label>
                        </Chip>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">连接状态</span>
                      </div>
                      {connectionStatus === 'checking' ? (
                        <Chip size="sm" data-color="default" variant="soft">
                          {<Spinner size="sm" color="current" />}
                          <Chip.Label>检测中...</Chip.Label>
                        </Chip>
                      ) : (
                        <Chip
                          size="sm"
                          data-color={
                            connectionStatus === 'connected'
                              ? 'success'
                              : connectionStatus === 'disconnected'
                                ? 'danger'
                                : 'default'
                          }
                          variant="soft"
                        >
                          <Chip.Label>{getConnectionStatusText()}</Chip.Label>
                        </Chip>
                      )}
                    </div>
                  </Card.Content>
                </Card>

                <Separator />

                <div className="text-xs text-default-500 space-y-2">
                  <div className="flex items-start gap-2">
                    <span>
                      {systemCoreOnlyBuild
                        ? `使用系统服务：${systemServicePath}`
                        : '提供系统代理设置和核心进程管理的提权功能'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>未安装状态下部分高级功能将无法使用</span>
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer className="flex-col gap-2 sm:flex-row">
              <Button
                size="sm"
                onPress={() => onChange(false)}
                variant="ghost"
                data-color="default"
                className="sm:mr-auto"
                isDisabled={loading}
              >
                关闭
              </Button>

              {status === 'unknown' ? null : status === 'not-installed' ? (
                <Button
                  size="sm"
                  onPress={() => handleAction(onInstall)}
                  variant="primary"
                  data-color="primary"
                  data-shadow="true"
                  isPending={loading}
                  isDisabled={loading}
                >
                  {loading ? <Spinner size="sm" color="current" /> : null}安装服务
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    onPress={() => handleAction(onInit)}
                    variant="secondary"
                    data-color="primary"
                    isPending={loading}
                    isDisabled={loading}
                  >
                    {loading ? <Spinner size="sm" color="current" /> : null}
                    {status === 'need-init' ? '初始化' : '重置认证'}
                  </Button>
                  <Button
                    size="sm"
                    onPress={() => handleAction(onRestart)}
                    variant="secondary"
                    data-color="primary"
                    isPending={loading}
                    isDisabled={loading}
                  >
                    {loading ? <Spinner size="sm" color="current" /> : null}重启
                  </Button>
                  {status !== 'running' && status !== 'need-init' ? (
                    <Button
                      size="sm"
                      onPress={() => handleAction(onStart, true)}
                      variant="primary"
                      data-color="success"
                      data-shadow="true"
                      isPending={loading}
                      isDisabled={loading}
                    >
                      {loading ? <Spinner size="sm" color="current" /> : null}启动
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    onPress={() => handleAction(onUninstall)}
                    variant="secondary"
                    data-color="danger"
                    isPending={loading}
                    isDisabled={loading}
                  >
                    {loading ? <Spinner size="sm" color="current" /> : null}卸载
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ServiceModal
