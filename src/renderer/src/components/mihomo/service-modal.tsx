import { Chip, Spinner, Button, Modal, Tabs } from '@heroui/react'

import React, { useEffect, useState, useCallback } from 'react'

import { serviceStatus, testServiceConnection } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { notify } from '@renderer/utils/notification'

interface Props {
  onChange: (open: boolean) => void
  serviceRunMode: NonNullable<AppConfig['serviceRunMode']>
  onRunModeChange: (mode: NonNullable<AppConfig['serviceRunMode']>) => Promise<void>
  serviceCpuAffinity: number[]
  onCpuAffinityChange: (cpus: number[]) => Promise<void>
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
  const {
    onChange,
    serviceRunMode,
    onRunModeChange,
    serviceCpuAffinity,
    onCpuAffinityChange,
    onInit,
    onInstall,
    onUninstall,
    onStart,
    onRestart
  } = props
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<ServiceStatusType | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusType>('checking')
  const cpuCount = Math.max(1, navigator.hardwareConcurrency || 1)
  const cpuList = Array.from({ length: cpuCount }, (_, index) => index)

  const toggleCpu = (cpu: number): void => {
    const next = serviceCpuAffinity.includes(cpu)
      ? serviceCpuAffinity.filter((item) => item !== cpu)
      : [...serviceCpuAffinity, cpu].sort((a, b) => a - b)
    void onCpuAffinityChange(next)
  }

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

  const summaryText =
    status === null || connectionStatus === 'checking'
      ? '正在检查'
      : status === 'running'
        ? connectionStatus === 'connected'
          ? '运行中，已连接'
          : '运行中，未连接'
        : status === 'stopped'
          ? '已停止'
          : status === 'not-installed'
            ? '未安装'
            : status === 'need-init'
              ? '需要初始化'
              : status === 'paused'
                ? '已暂停'
                : '状态未知'

  const statusColor: 'success' | 'warning' | 'danger' | 'default' =
    status === null || connectionStatus === 'checking'
      ? 'default'
      : status === 'running' && connectionStatus === 'connected'
        ? 'success'
        : status === 'not-installed' || connectionStatus === 'disconnected'
          ? 'danger'
          : status === 'stopped' || status === 'need-init' || status === 'paused'
            ? 'warning'
            : 'default'

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
            <Modal.Header className="app-drag flex-col gap-1">
              <Modal.Heading>Sparkle 服务管理</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="divide-y divide-default-200">
              <div className="flex h-11 items-center gap-3">
                <span className="w-20 shrink-0 text-sm">服务状态</span>
                <div className="flex min-w-0 flex-1 justify-end">
                  <Chip size="sm" data-color={statusColor} variant="soft">
                    {status === null || connectionStatus === 'checking' ? (
                      <Spinner size="sm" color="current" />
                    ) : null}
                    <Chip.Label>{summaryText}</Chip.Label>
                  </Chip>
                </div>
              </div>

              {platform === 'linux' && (
                <div className="flex h-11 items-center gap-3">
                  <span className="w-20 shrink-0 text-sm">运行方式</span>
                  <div className="flex min-w-0 flex-1 justify-end">
                    <Tabs
                      selectedKey={serviceRunMode}
                      onSelectionChange={(key) =>
                        onRunModeChange(key as NonNullable<AppConfig['serviceRunMode']>)
                      }
                      isDisabled={loading}
                      data-color="primary"
                      data-size="sm"
                    >
                      <Tabs.ListContainer>
                        <Tabs.List aria-label="服务核心运行方式">
                          <Tabs.Tab id="auto">
                            自动
                            <Tabs.Indicator />
                          </Tabs.Tab>
                          <Tabs.Tab id="sandbox">
                            沙盒
                            <Tabs.Indicator />
                          </Tabs.Tab>
                          <Tabs.Tab id="direct">
                            直接启动
                            <Tabs.Indicator />
                          </Tabs.Tab>
                        </Tabs.List>
                      </Tabs.ListContainer>
                    </Tabs>
                  </div>
                </div>
              )}

              {(platform === 'linux' || platform === 'win32') && (
                <div className="flex h-11 items-center gap-3">
                  <span className="w-20 shrink-0 text-sm">核心绑定</span>
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                    {cpuList.map((cpu) => {
                      const selected = serviceCpuAffinity.includes(cpu)
                      return (
                        <button
                          key={cpu}
                          type="button"
                          aria-label={`核心 ${cpu}`}
                          aria-pressed={selected}
                          disabled={loading}
                          className={`flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-all disabled:pointer-events-none disabled:opacity-50 ${
                            selected
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'bg-default-100 text-default-500 hover:bg-default-200 hover:text-foreground'
                          }`}
                          onClick={() => toggleCpu(cpu)}
                        >
                          {cpu}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="flex-col gap-2 sm:flex-row sm:items-center">
              {status === 'unknown' ? null : status === 'not-installed' ? (
                <Button
                  size="sm"
                  onPress={() => handleAction(onInstall)}
                  variant="primary"
                  data-color="primary"
                  data-shadow="true"
                  className="w-full sm:ml-auto sm:w-auto sm:min-w-18"
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
                    data-color="default"
                    className="w-full sm:w-auto sm:min-w-18"
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
                    data-color="default"
                    className="w-full sm:w-auto sm:min-w-18"
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
                      className="w-full sm:w-auto sm:min-w-18"
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
                    variant="danger-soft"
                    className="w-full sm:ml-auto sm:w-auto sm:min-w-18"
                    isPending={loading}
                    isDisabled={loading}
                  >
                    {loading ? <Spinner size="sm" color="current" /> : null}卸载
                  </Button>
                </>
              )}
            </Modal.Footer>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ServiceModal
