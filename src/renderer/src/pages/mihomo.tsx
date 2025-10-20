import { Button, Input, Select, SelectItem, Switch, Tab, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import ConfirmModal from '@renderer/components/base/base-confirm'
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
  checkCorePermission,
  findSystemMihomo
} from '@renderer/utils/ipc'
import React, { useState, useEffect } from 'react'
import ControllerSetting from '@renderer/components/mihomo/controller-setting'
import EnvSetting from '@renderer/components/mihomo/env-setting'
import AdvancedSetting from '@renderer/components/mihomo/advanced-settings'

let systemCorePathsCache: string[] | null = null
let cachePromise: Promise<string[]> | null = null
let isInitializing = false

const getSystemCorePaths = async (): Promise<string[]> => {
  if (systemCorePathsCache !== null) {
    return systemCorePathsCache
  }

  if (cachePromise !== null) {
    return cachePromise
  }

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

if (!isInitializing) {
  isInitializing = true
  getSystemCorePaths().catch(() => {})
}

const Mihomo: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core = 'mihomo', maxLogDays = 7, corePermissionMode = 'elevated' } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { ipv6, 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const [upgrading, setUpgrading] = useState(false)
  const [showUnGrantConfirm, setShowUnGrantConfirm] = useState(false)
  const [pendingPermissionMode, setPendingPermissionMode] = useState<string>('')
  const [systemCorePaths, setSystemCorePaths] = useState<string[]>(systemCorePathsCache || [])
  const [loadingPaths, setLoadingPaths] = useState(systemCorePathsCache === null)

  useEffect(() => {
    if (systemCorePathsCache !== null) {
      return
    }

    const loadSystemPaths = async (): Promise<void> => {
      try {
        const paths = await getSystemCorePaths()
        setSystemCorePaths(paths)
      } catch {
        // ignore
      } finally {
        setLoadingPaths(false)
      }
    }
    loadSystemPaths()
  }, [])

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  const handleConfigChangeWithRestart = async (key: string, value: unknown): Promise<void> => {
    try {
      await patchAppConfig({ [key]: value })
      await restartCore()
    } catch (e) {
      alert(e)
    } finally {
      PubSub.publish('mihomo-core-changed')
    }
  }

  return (
    <BasePage title="内核设置">
      {showUnGrantConfirm && (
        <ConfirmModal
          onChange={setShowUnGrantConfirm}
          title="确认撤销内核权限？"
          description="撤销内核权限后，虚拟网卡等功能可能无法正常工作。确定要继续吗？"
          confirmText="确认撤销"
          cancelText="取消"
          onConfirm={async () => {
            try {
              await revokeCorePermission()
              await patchAppConfig({
                corePermissionMode: pendingPermissionMode as 'none' | 'elevated' | 'service'
              })
              await patchControledMihomoConfig({ tun: { enable: false } })
              new Notification('内核权限已撤销')
              await restartCore()
            } catch (e) {
              alert(e)
            }
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
                onPress={async () => {
                  try {
                    setUpgrading(true)
                    await mihomoUpgrade()
                    setTimeout(() => {
                      PubSub.publish('mihomo-core-changed')
                    }, 2000)
                  } catch (e) {
                    if (typeof e === 'string' && e.includes('already using latest version')) {
                      new Notification('已经是最新版本')
                    } else {
                      alert(e)
                    }
                  } finally {
                    setUpgrading(false)
                  }
                }}
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
            onSelectionChange={async (v) => {
              const newCore = v.currentKey as 'mihomo' | 'mihomo-alpha' | 'system'
              if (newCore === 'system' && corePermissionMode === 'elevated') {
                await patchAppConfig({ corePermissionMode: 'none' })
                await patchControledMihomoConfig({ tun: { enable: false } })
              }
              handleConfigChangeWithRestart('core', newCore)
            }}
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
              onSelectionChange={async (v) => {
                handleConfigChangeWithRestart('systemCorePath', v.currentKey as string)
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
          </SettingItem>
        )}
        <SettingItem title="内核权限管理" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={corePermissionMode}
            disabledKeys={core === 'system' ? ['elevated'] : []}
            onSelectionChange={async (key) => {
              if (key !== 'elevated' && corePermissionMode === 'elevated') {
                const hasSuid = await checkCorePermission()
                if (hasSuid) {
                  setPendingPermissionMode(key as string)
                  setShowUnGrantConfirm(true)
                } else {
                  patchAppConfig({ corePermissionMode: key as 'none' | 'elevated' | 'service' })
                }
              } else {
                patchAppConfig({ corePermissionMode: key as 'none' | 'elevated' | 'service' })
              }
            }}
          >
            <Tab key="none" title="无" />
            <Tab key="elevated" title="授权运行" />
            <Tab key="service" title="系统服务" />
          </Tabs>
        </SettingItem>
        {platform !== 'win32' && corePermissionMode === 'elevated' && (
          <SettingItem title="手动授权内核" divider>
            <Button
              size="sm"
              color="primary"
              onPress={async () => {
                try {
                  await manualGrantCorePermition()
                  new Notification('内核授权成功')
                  await restartCore()
                } catch (e) {
                  alert(e)
                }
              }}
            >
              授权内核
            </Button>
          </SettingItem>
        )}
        {corePermissionMode === 'service' && (
          <SettingItem title="服务管理" divider>
            <Button
              size="sm"
              color="primary"
              onPress={async () => {
                alert('该功能正在开发中')
              }}
            >
              安装服务
            </Button>
          </SettingItem>
        )}
        <SettingItem title="IPv6" divider>
          <Switch
            size="sm"
            isSelected={ipv6}
            onValueChange={(v) => {
              onChangeNeedRestart({ ipv6: v })
            }}
          />
        </SettingItem>
        <SettingItem title="日志保留天数" divider>
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={maxLogDays.toString()}
            onValueChange={(v) => {
              patchAppConfig({ maxLogDays: parseInt(v) })
            }}
          />
        </SettingItem>
        <SettingItem title="日志等级">
          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-[100px]"
            size="sm"
            selectedKeys={new Set([logLevel])}
            disallowEmptySelection={true}
            onSelectionChange={(v) => {
              onChangeNeedRestart({ 'log-level': v.currentKey as LogLevel })
            }}
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
