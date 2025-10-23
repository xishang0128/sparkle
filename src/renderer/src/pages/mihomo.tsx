import { Button, Input, Select, SelectItem, Switch, Tab, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import ConfirmModal, { ConfirmButton } from '@renderer/components/base/base-confirm'
import PermissionModal from '@renderer/components/mihomo/permission-modal'
import ServiceModal from '@renderer/components/mihomo/service-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import PortSetting from '@renderer/components/mihomo/port-setting'
import { platform } from '@renderer/utils/init'
import { IoMdCloudDownload } from 'react-icons/io'
import PubSub from 'pubsub-js'
import {
  manualGrantCorePermition,
  mihomoUpgrade,
  restartCore,
  revokeCorePermission,
  findSystemMihomo,
  deleteElevateTask,
  checkElevateTask,
  relaunchApp,
  notDialogQuit,
  installService,
  uninstallService,
  startService,
  stopService,
  initService,
  restartService
} from '@renderer/utils/ipc'
import React, { useState, useEffect } from 'react'
import ControllerSetting from '@renderer/components/mihomo/controller-setting'
import EnvSetting from '@renderer/components/mihomo/env-setting'
import AdvancedSetting from '@renderer/components/mihomo/advanced-settings'

let systemCorePathsCache: string[] | null = null
let cachePromise: Promise<string[]> | null = null

const getSystemCorePaths = async (): Promise<string[]> => {
  if (systemCorePathsCache !== null) return systemCorePathsCache
  if (cachePromise !== null) return cachePromise

  cachePromise = findSystemMihomo()
    .then((paths) => {
      systemCorePathsCache = paths
      cachePromise = null
      return paths
    })
    .catch(() => {
      cachePromise = null
      return []
    })

  return cachePromise
}

getSystemCorePaths().catch(() => {})

const Mihomo: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core = 'mihomo', maxLogDays = 7, corePermissionMode = 'elevated' } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { ipv6, 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const [upgrading, setUpgrading] = useState(false)
  const [showGrantConfirm, setShowGrantConfirm] = useState(false)
  const [showUnGrantConfirm, setShowUnGrantConfirm] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [pendingPermissionMode, setPendingPermissionMode] = useState<string>('')
  const [systemCorePaths, setSystemCorePaths] = useState<string[]>(systemCorePathsCache || [])
  const [loadingPaths, setLoadingPaths] = useState(systemCorePathsCache === null)

  useEffect(() => {
    if (systemCorePathsCache !== null) return

    getSystemCorePaths()
      .then(setSystemCorePaths)
      .catch(() => {})
      .finally(() => setLoadingPaths(false))
  }, [])

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  const handleConfigChangeWithRestart = async (key: string, value: unknown): Promise<void> => {
    try {
      await patchAppConfig({ [key]: value })
      await restartCore()
      PubSub.publish('mihomo-core-changed')
    } catch (e) {
      alert(e)
    }
  }

  const handleCoreUpgrade = async (): Promise<void> => {
    try {
      setUpgrading(true)
      await mihomoUpgrade()
      setTimeout(() => PubSub.publish('mihomo-core-changed'), 2000)
    } catch (e) {
      if (typeof e === 'string' && e.includes('already using latest version')) {
        new Notification('已经是最新版本')
      } else {
        alert(e)
      }
    } finally {
      setUpgrading(false)
    }
  }

  const handleCoreChange = async (newCore: 'mihomo' | 'mihomo-alpha' | 'system'): Promise<void> => {
    if (newCore === 'system') {
      const paths = await getSystemCorePaths()

      if (paths.length === 0) {
        new Notification('未找到系统内核', {
          body: '系统中未找到可用的 mihomo 或 clash 内核，已自动切换回内置内核'
        })
        return
      }

      if (!appConfig?.systemCorePath || !paths.includes(appConfig.systemCorePath)) {
        await patchAppConfig({ systemCorePath: paths[0] })
      }
    }
    handleConfigChangeWithRestart('core', newCore)
  }

  const handlePermissionModeChange = async (key: string): Promise<void> => {
    if (platform === 'win32') {
      if (key !== 'elevated') {
        if (await checkElevateTask()) {
          setPendingPermissionMode(key)
          setShowUnGrantConfirm(true)
        } else {
          patchAppConfig({ corePermissionMode: key as 'elevated' | 'service' })
        }
      } else if (key === 'elevated') {
        setPendingPermissionMode(key)
        setShowGrantConfirm(true)
      }
    } else {
      patchAppConfig({ corePermissionMode: key as 'elevated' | 'service' })
    }
  }

  const unGrantButtons: ConfirmButton[] = [
    {
      key: 'cancel',
      text: '取消',
      variant: 'light',
      onPress: () => {}
    },
    {
      key: 'confirm',
      text: platform === 'win32' ? '不重启取消' : '确认撤销',
      color: 'warning',
      onPress: async () => {
        try {
          if (platform === 'win32') {
            await deleteElevateTask()
            new Notification('任务计划已取消注册')
          } else {
            await revokeCorePermission()
            new Notification('内核权限已撤销')
          }
          await patchAppConfig({
            corePermissionMode: pendingPermissionMode as 'elevated' | 'service'
          })

          await restartCore()
        } catch (e) {
          alert(e)
        }
      }
    },
    ...(platform === 'win32'
      ? [
          {
            key: 'cancel-and-restart',
            text: '取消并重启',
            color: 'danger' as const,
            onPress: async () => {
              try {
                await deleteElevateTask()
                new Notification('任务计划已取消注册')
                await patchAppConfig({
                  corePermissionMode: pendingPermissionMode as 'elevated' | 'service'
                })
                await relaunchApp()
              } catch (e) {
                alert(e)
              }
            }
          }
        ]
      : [])
  ]

  return (
    <BasePage title="内核设置">
      {showGrantConfirm && (
        <ConfirmModal
          onChange={setShowGrantConfirm}
          title="确认使用任务计划？"
          description="确认后将退出应用，请手动使用管理员运行一次程序"
          onConfirm={async () => {
            await patchAppConfig({
              corePermissionMode: pendingPermissionMode as 'elevated' | 'service'
            })
            await notDialogQuit()
          }}
        />
      )}
      {showUnGrantConfirm && (
        <ConfirmModal
          onChange={setShowUnGrantConfirm}
          title="确认取消任务计划？"
          description="取消任务计划后，虚拟网卡等功能可能无法正常工作。确定要继续吗？"
          buttons={unGrantButtons}
        />
      )}
      {showPermissionModal && (
        <PermissionModal
          onChange={setShowPermissionModal}
          onRevoke={async () => {
            if (platform === 'win32') {
              await deleteElevateTask()
              new Notification('任务计划已取消注册')
            } else {
              await revokeCorePermission()
              new Notification('内核权限已撤销')
            }
            await restartCore()
          }}
          onGrant={async () => {
            await manualGrantCorePermition()
            new Notification('内核授权成功')
            await restartCore()
          }}
        />
      )}
      {showServiceModal && (
        <ServiceModal
          onChange={setShowServiceModal}
          onInit={async () => {
            await initService()
            new Notification('服务初始化成功')
          }}
          onInstall={async () => {
            await installService()
            new Notification('服务安装成功')
          }}
          onUninstall={async () => {
            await uninstallService()
            new Notification('服务卸载成功')
          }}
          onStart={async () => {
            await startService()
            new Notification('服务启动成功')
          }}
          onRestart={async () => {
            await restartService()
            new Notification('服务重启成功')
          }}
          onStop={async () => {
            await stopService()
            new Notification('服务停止成功')
          }}
        />
      )}
      <SettingCard>
        <SettingItem
          title="内核版本"
          actions={
            core === 'mihomo' || core === 'mihomo-alpha' ? (
              <Button
                size="sm"
                isIconOnly
                title="升级内核"
                variant="light"
                isLoading={upgrading}
                onPress={handleCoreUpgrade}
              >
                <IoMdCloudDownload className="text-lg" />
              </Button>
            ) : null
          }
          divider
        >
          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-[150px]"
            size="sm"
            selectedKeys={new Set([core])}
            disallowEmptySelection={true}
            onSelectionChange={(v) =>
              handleCoreChange(v.currentKey as 'mihomo' | 'mihomo-alpha' | 'system')
            }
          >
            <SelectItem key="mihomo">内置稳定版</SelectItem>
            <SelectItem key="mihomo-alpha">内置预览版</SelectItem>
            <SelectItem key="system">使用系统内核</SelectItem>
          </Select>
        </SettingItem>
        {core === 'system' && (
          <SettingItem title="系统内核路径选择" divider>
            <Select
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-[350px]"
              size="sm"
              selectedKeys={new Set([appConfig?.systemCorePath || ''])}
              disallowEmptySelection={systemCorePaths.length > 0}
              isDisabled={loadingPaths}
              onSelectionChange={(v) => {
                const selectedPath = v.currentKey as string
                if (selectedPath) handleConfigChangeWithRestart('systemCorePath', selectedPath)
              }}
            >
              {loadingPaths ? (
                <SelectItem key="">正在查找系统内核...</SelectItem>
              ) : systemCorePaths.length > 0 ? (
                systemCorePaths.map((path) => <SelectItem key={path}>{path}</SelectItem>)
              ) : (
                <SelectItem key="">未找到系统内核</SelectItem>
              )}
            </Select>
            {!loadingPaths && systemCorePaths.length === 0 && (
              <div className="mt-2 text-sm text-warning">
                未在系统中找到 mihomo 或 clash 内核，请安装后重试
              </div>
            )}
          </SettingItem>
        )}
        <SettingItem title="内核提权模式" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={corePermissionMode}
            disabledKeys={core === 'system' && platform !== 'win32' ? ['elevated'] : []}
            onSelectionChange={(key) => handlePermissionModeChange(key as string)}
          >
            <Tab key="elevated" title={platform === 'win32' ? '任务计划' : '授权运行'} />
            <Tab key="service" title="系统服务" />
          </Tabs>
        </SettingItem>
        <SettingItem title={platform === 'win32' ? '任务状态' : '授权状态'} divider>
          <Button size="sm" color="primary" onPress={() => setShowPermissionModal(true)}>
            管理
          </Button>
        </SettingItem>
        <SettingItem title="服务状态" divider>
          <Button size="sm" color="primary" onPress={() => setShowServiceModal(true)}>
            管理
          </Button>
        </SettingItem>
        <SettingItem title="IPv6" divider>
          <Switch
            size="sm"
            isSelected={ipv6}
            onValueChange={(v) => onChangeNeedRestart({ ipv6: v })}
          />
        </SettingItem>
        <SettingItem title="日志保留天数" divider>
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={maxLogDays.toString()}
            onValueChange={(v) => patchAppConfig({ maxLogDays: parseInt(v) })}
          />
        </SettingItem>
        <SettingItem title="日志等级">
          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-[100px]"
            size="sm"
            selectedKeys={new Set([logLevel])}
            disallowEmptySelection={true}
            onSelectionChange={(v) =>
              onChangeNeedRestart({ 'log-level': v.currentKey as LogLevel })
            }
          >
            <SelectItem key="silent">静默</SelectItem>
            <SelectItem key="error">错误</SelectItem>
            <SelectItem key="warning">警告</SelectItem>
            <SelectItem key="info">信息</SelectItem>
            <SelectItem key="debug">调试</SelectItem>
          </Select>
        </SettingItem>
      </SettingCard>
      <PortSetting />
      <ControllerSetting />
      <EnvSetting />
      <AdvancedSetting />
    </BasePage>
  )
}

export default Mihomo
