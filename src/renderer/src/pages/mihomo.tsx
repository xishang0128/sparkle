import { Button, Input, Select, SelectItem, Switch } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import PortSetting from '@renderer/components/mihomo/port-setting'
import { platform } from '@renderer/utils/init'
import { IoMdCloudDownload } from 'react-icons/io'
import PubSub from 'pubsub-js'
import { manualGrantCorePermition, mihomoUpgrade, restartCore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import ControllerSetting from '@renderer/components/mihomo/controller-setting'
import EnvSetting from '@renderer/components/mihomo/env-setting'
import AdvancedSetting from '@renderer/components/mihomo/advanced-settings'

const CoreMap = {
  mihomo: '稳定版',
  'mihomo-alpha': '预览版'
}

const Mihomo: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { core = 'mihomo', maxLogDays = 7 } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { ipv6, 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const [upgrading, setUpgrading] = useState(false)

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
      <SettingCard>
        <SettingItem
          title="内核版本"
          actions={
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
                  if (platform !== 'win32') {
                    new Notification('内核权限丢失', {
                      body: '内核升级成功，若要使用虚拟网卡（Tun），请到虚拟网卡页面重新手动授权内核'
                    })
                  }
                } catch (e) {
                  if (
                    typeof e === 'string' &&
                    (e.includes('already using latest version') ||
                      e.includes('is the latest version'))
                  ) {
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
          }
          divider
        >
          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-[100px]"
            size="sm"
            selectedKeys={new Set([core])}
            disallowEmptySelection={true}
            onSelectionChange={async (v) => {
              handleConfigChangeWithRestart('core', v.currentKey as 'mihomo' | 'mihomo-alpha')
            }}
          >
            <SelectItem key="mihomo">{CoreMap['mihomo']}</SelectItem>
            <SelectItem key="mihomo-alpha">{CoreMap['mihomo-alpha']}</SelectItem>
          </Select>
        </SettingItem>
        {platform !== 'win32' && (
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
