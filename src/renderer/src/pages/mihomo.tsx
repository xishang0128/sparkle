import { Button, Spinner, Select, Switch, Tabs, ListBox } from '@heroui/react'

import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
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
  installService,
  uninstallService,
  startService,
  initService,
  restartService
} from '@renderer/utils/ipc'
import React, { useState, useEffect } from 'react'
import ControllerSetting from '@renderer/components/mihomo/controller-setting'
import EnvSetting from '@renderer/components/mihomo/env-setting'
import AdvancedSetting from '@renderer/components/mihomo/advanced-settings'
import LogSetting from '@renderer/components/mihomo/log-setting'
import { notify } from '@renderer/utils/notification'
import { systemCoreOnlyBuild } from '../../../shared/build-flags'

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
  const {
    core = 'mihomo',
    corePermissionMode = 'elevated',
    serviceRunMode = 'auto',
    coreStartupMode = 'post-up',
    mihomoCpuPriority = 'PRIORITY_NORMAL'
  } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { ipv6 } = controledMihomoConfig || {}

  const [upgrading, setUpgrading] = useState(false)
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
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
      notify(e, { variant: 'danger' })
    }
  }

  const handleCoreUpgrade = async (): Promise<void> => {
    try {
      setUpgrading(true)
      await mihomoUpgrade(core === 'mihomo' ? 'release' : 'alpha')
      setTimeout(() => PubSub.publish('mihomo-core-changed'), 2000)
    } catch (e) {
      if (typeof e === 'string' && e.includes('already using latest version')) {
        notify('已经是最新版本')
      } else {
        notify(e, { variant: 'danger' })
      }
    } finally {
      setUpgrading(false)
    }
  }

  const handleCoreChange = async (newCore: 'mihomo' | 'mihomo-alpha' | 'system'): Promise<void> => {
    if (newCore === 'system') {
      const paths = await getSystemCorePaths()

      if (paths.length === 0) {
        notify('未找到系统内核', {
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
    if (key === corePermissionMode) return

    try {
      await patchAppConfig({ corePermissionMode: key as 'elevated' | 'service' })
      await restartCore()
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  return (
    <BasePage title="内核设置" contentClassName="no-scrollbar">
      {!systemCoreOnlyBuild && showPermissionModal && (
        <PermissionModal
          onChange={setShowPermissionModal}
          onRevoke={async () => {
            if (platform === 'win32') {
              await deleteElevateTask()
              notify('提权配置已取消')
            } else {
              await revokeCorePermission()
              notify('内核权限已撤销')
            }
            await restartCore()
          }}
          onGrant={async () => {
            await manualGrantCorePermition()
            notify(platform === 'win32' ? '提权配置成功' : '内核授权成功')
            await restartCore()
          }}
        />
      )}
      {showServiceModal && (
        <ServiceModal
          onChange={setShowServiceModal}
          onInit={async () => {
            await initService()
            notify('服务初始化成功')
          }}
          onInstall={async () => {
            await installService()
            notify('服务安装成功')
          }}
          onUninstall={async () => {
            await uninstallService()
            notify('服务卸载成功')
          }}
          onStart={async () => {
            await startService()
            notify('服务启动成功')
          }}
          onRestart={async () => {
            await restartService()
            notify('服务重启成功')
          }}
        />
      )}
      <SettingCard>
        {systemCoreOnlyBuild ? null : (
          <SettingItem
            compatKey="legacy"
            title="内核版本"
            actions={
              core === 'mihomo' || core === 'mihomo-alpha' ? (
                <Button
                  size="sm"
                  isIconOnly
                  onPress={handleCoreUpgrade}
                  variant="ghost"
                  data-color="default"
                  isPending={upgrading}
                  isDisabled={upgrading}
                >
                  {upgrading ? (
                    <Spinner size="sm" color="current" />
                  ) : (
                    <IoMdCloudDownload className="text-lg" />
                  )}
                </Button>
              ) : null
            }
            divider
          >
            <Select
              aria-label="内核版本"
              className={['w-37.5'].filter(Boolean).join(' ')}
              data-size="sm"
              value={core ?? null}
              onChange={(v) => handleCoreChange(v as 'mihomo' | 'mihomo-alpha' | 'system')}
            >
              <Select.Trigger className="data-[hover=true]:bg-default-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item key="mihomo" id="mihomo" textValue="内置稳定版">
                    内置稳定版
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item key="mihomo-alpha" id="mihomo-alpha" textValue="内置预览版">
                    内置预览版
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item key="system" id="system" textValue="使用系统内核">
                    使用系统内核
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </SettingItem>
        )}
        {core === 'system' && (
          <SettingItem compatKey="legacy" title="系统内核路径选择" divider>
            <Select
              aria-label="系统内核路径"
              isDisabled={loadingPaths}
              className={['w-87.5'].filter(Boolean).join(' ')}
              data-size="sm"
              value={(appConfig?.systemCorePath || '') ?? null}
              onChange={(v) => {
                const selectedPath = v as string
                if (selectedPath) handleConfigChangeWithRestart('systemCorePath', selectedPath)
              }}
            >
              <Select.Trigger className="data-[hover=true]:bg-default-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {loadingPaths ? (
                    <ListBox.Item key="" id="" textValue="正在查找系统内核...">
                      正在查找系统内核...
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ) : systemCorePaths.length > 0 ? (
                    systemCorePaths.map((path) => (
                      <ListBox.Item key={path} id={path} textValue={path}>
                        {path}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))
                  ) : (
                    <ListBox.Item key="" id="" textValue="未找到系统内核">
                      未找到系统内核
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
            {!loadingPaths && systemCorePaths.length === 0 && (
              <div className="mt-2 text-sm text-warning">
                未在系统中找到 mihomo 或 clash 内核，请安装后重试
              </div>
            )}
          </SettingItem>
        )}
        <SettingItem compatKey="legacy" title="内核进程优先级" divider>
          <Select
            aria-label="内核进程优先级"
            className={['w-37.5'].filter(Boolean).join(' ')}
            data-size="sm"
            value={mihomoCpuPriority ?? null}
            onChange={async (v) => {
              try {
                await patchAppConfig({
                  mihomoCpuPriority: v as Priority
                })
                await restartCore()
              } catch (e) {
                notify(e, { variant: 'danger' })
              }
            }}
          >
            <Select.Trigger className="data-[hover=true]:bg-default-200">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item key="PRIORITY_HIGHEST" id="PRIORITY_HIGHEST" textValue="实时">
                  实时
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="PRIORITY_HIGH" id="PRIORITY_HIGH" textValue="高">
                  高<ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item
                  key="PRIORITY_ABOVE_NORMAL"
                  id="PRIORITY_ABOVE_NORMAL"
                  textValue="高于正常"
                >
                  高于正常
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="PRIORITY_NORMAL" id="PRIORITY_NORMAL" textValue="正常">
                  正常
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item
                  key="PRIORITY_BELOW_NORMAL"
                  id="PRIORITY_BELOW_NORMAL"
                  textValue="低于正常"
                >
                  低于正常
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item key="PRIORITY_LOW" id="PRIORITY_LOW" textValue="低">
                  低<ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingItem>
        <SettingItem compatKey="legacy" title="运行模式" divider>
          <Tabs
            selectedKey={corePermissionMode}
            onSelectionChange={(key) => handlePermissionModeChange(key as string)}
            data-color="primary"
            data-size="sm"
            data-full-width={false}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="选项">
                <Tabs.Tab key="elevated" id="elevated">
                  直接运行
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab key="service" id="service">
                  系统服务
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </SettingItem>
        {platform === 'linux' && corePermissionMode === 'service' && (
          <SettingItem compatKey="legacy" title="服务核心运行方式" divider>
            <Tabs
              selectedKey={serviceRunMode}
              onSelectionChange={(key) => handleConfigChangeWithRestart('serviceRunMode', key)}
              data-color="primary"
              data-size="sm"
              data-full-width={false}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="选项">
                  <Tabs.Tab key="auto" id="auto">
                    自动
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab key="sandbox" id="sandbox">
                    沙盒
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab key="direct" id="direct">
                    直接启动
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </SettingItem>
        )}
        {corePermissionMode !== 'service' && (
          <SettingItem compatKey="legacy" title="启动检测方式" divider>
            <Tabs
              selectedKey={coreStartupMode}
              onSelectionChange={(key) => handleConfigChangeWithRestart('coreStartupMode', key)}
              data-color="primary"
              data-size="sm"
              data-full-width={false}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="选项">
                  <Tabs.Tab key="post-up" id="post-up">
                    Post Up
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab key="log" id="log">
                    日志解析
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </SettingItem>
        )}
        {!systemCoreOnlyBuild && (
          <SettingItem compatKey="legacy" title="提权状态" divider>
            <Button
              size="sm"
              onPress={() => setShowPermissionModal(true)}
              variant="primary"
              data-color="primary"
            >
              管理
            </Button>
          </SettingItem>
        )}
        <SettingItem compatKey="legacy" title="服务状态" divider>
          <Button
            size="sm"
            onPress={() => setShowServiceModal(true)}
            variant="primary"
            data-color="primary"
          >
            管理
          </Button>
        </SettingItem>
        <SettingItem compatKey="legacy" title="IPv6">
          <Switch
            size="sm"
            isSelected={ipv6}
            onChange={(v) => onChangeNeedRestart({ ipv6: v })}
            aria-label="IPv6"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
      </SettingCard>
      <PortSetting />
      <ControllerSetting />
      <EnvSetting />
      <LogSetting />
      <AdvancedSetting />
    </BasePage>
  )
}

export default Mihomo
