import React, { useEffect, useState, useCallback } from 'react'
import { Button, Spinner, Card, CardBody, Chip, Divider } from '@heroui/react'
import { Modal } from '@heroui-v3/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { serviceStatus, testServiceConnection } from '@renderer/utils/ipc'

interface Props {
  onChange: (open: boolean) => void
  onInit: () => Promise<void>
  onInstall: () => Promise<void>
  onUninstall: () => Promise<void>
  onStart: () => Promise<void>
  onRestart: () => Promise<void>
  onStop: () => Promise<void>
}

type ServiceStatusType = 'running' | 'stopped' | 'not-installed' | 'unknown' | 'need-init'
type ConnectionStatusType = 'connected' | 'disconnected' | 'checking' | 'unknown'

const ServiceModal: React.FC<Props> = (props) => {
  const { onChange, onInit, onInstall, onUninstall, onStart, onStop, onRestart } = props
  useAppConfig()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ServiceStatusType | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('checking')

  const checkServiceConnection = useCallback(async (): Promise<void> => {
    if (status === 'running') {
      try {
        setConnectionStatus('checking')
        const connected = await testServiceConnection()
        setConnectionStatus(connected ? 'connected' : 'disconnected')
      } catch {
        setConnectionStatus('disconnected')
      }
    } else {
      setConnectionStatus('disconnected')
    }
  }, [status])

  useEffect(() => {
    const checkStatus = async (): Promise<void> => {
      try {
        const result = await serviceStatus()
        setStatus(result)
      } catch {
        setStatus('not-installed')
      }
    }
    checkStatus()
  }, [])

  useEffect(() => {
    checkServiceConnection()
  }, [status, checkServiceConnection])

  const handleAction = async (
    action: () => Promise<void>,
    isStartAction = false
  ): Promise<void> => {
    setLoading(true)
    try {
      await action()

      await new Promise((resolve) => setTimeout(resolve, 500))

      let result = await serviceStatus()

      if (isStartAction) {
        let retries = 5
        while (retries > 0 && result === 'stopped') {
          await new Promise((resolve) => setTimeout(resolve, 1000))
          result = await serviceStatus()
          retries--
        }
      }

      setStatus(result)
      await checkServiceConnection()
    } catch (e) {
      const errorMsg = String(e)
      if (errorMsg.includes('用户取消操作') || errorMsg.includes('UserCancelledError')) {
        const result = await serviceStatus()
        setStatus(result)
        await checkServiceConnection()
        return
      }
      alert(e)
    } finally {
      setLoading(false)
    }
  }

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
                  shadow="sm"
                  className="border-none bg-linear-to-br from-default-50 to-default-100"
                >
                  <CardBody className="py-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">服务状态</span>
                      </div>
                      {status === null ? (
                        <Chip
                          color="default"
                          variant="flat"
                          size="sm"
                          startContent={<Spinner size="sm" color="current" />}
                        >
                          检查中...
                        </Chip>
                      ) : (
                        <Chip
                          color={
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
                          variant="flat"
                          size="sm"
                        >
                          {getStatusText()}
                        </Chip>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">连接状态</span>
                      </div>
                      {connectionStatus === 'checking' ? (
                        <Chip
                          color="default"
                          variant="flat"
                          size="sm"
                          startContent={<Spinner size="sm" color="current" />}
                        >
                          检测中...
                        </Chip>
                      ) : (
                        <Chip
                          color={
                            connectionStatus === 'connected'
                              ? 'success'
                              : connectionStatus === 'disconnected'
                                ? 'danger'
                                : 'default'
                          }
                          variant="flat"
                          size="sm"
                        >
                          {getConnectionStatusText()}
                        </Chip>
                      )}
                    </div>
                  </CardBody>
                </Card>

                <Divider />

                <div className="text-xs text-default-500 space-y-2">
                  <div className="flex items-start gap-2">
                    <span>提供系统代理设置和核心进程管理的提权功能</span>
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
                variant="light"
                onPress={() => onChange(false)}
                isDisabled={loading}
                className="sm:mr-auto"
              >
                关闭
              </Button>

              {status === 'unknown' ? null : status === 'not-installed' ? (
                <Button
                  size="sm"
                  color="primary"
                  variant="shadow"
                  onPress={() => handleAction(onInstall)}
                  isLoading={loading}
                >
                  安装服务
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => handleAction(onInit)}
                    isLoading={loading}
                  >
                    初始化
                  </Button>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => handleAction(onRestart)}
                    isLoading={loading}
                  >
                    重启
                  </Button>
                  {status === 'running' || status === 'need-init' ? (
                    <Button
                      size="sm"
                      color="warning"
                      variant="flat"
                      onPress={() => handleAction(onStop)}
                      isLoading={loading}
                    >
                      停止
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      color="success"
                      variant="shadow"
                      onPress={() => handleAction(onStart, true)}
                      isLoading={loading}
                    >
                      启动
                    </Button>
                  )}
                  <Button
                    size="sm"
                    color="danger"
                    variant="flat"
                    onPress={() => handleAction(onUninstall)}
                    isLoading={loading}
                  >
                    卸载
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
