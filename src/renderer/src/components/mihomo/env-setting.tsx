import { Button, Switch } from '@heroui/react'

import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/ipc'
import EditableList from '../base/base-list-editor'
import { platform } from '@renderer/utils/init'
import { notify } from '@renderer/utils/notification'
import PubSub from 'pubsub-js'

const EnvSetting: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    disableLoopbackDetector,
    disableEmbedCA,
    disableSystemCA,
    disableNftables,
    safePaths = []
  } = appConfig || {}
  const handleConfigChangeWithRestart = async (key: string, value: unknown): Promise<void> => {
    try {
      await patchAppConfig({ [key]: value })
      await restartCore()
    } catch (e) {
      notify(e, { variant: 'danger' })
    } finally {
      PubSub.publish('mihomo-core-changed')
    }
  }
  const [safePathsInput, setSafePathsInput] = useState(safePaths)

  return (
    <SettingCard header="环境变量">
      <SettingItem compatKey="legacy" title="禁用系统 CA" divider>
        <Switch
          size="sm"
          isSelected={disableSystemCA}
          onChange={(v) => {
            handleConfigChangeWithRestart('disableSystemCA', v)
          }}
          aria-label="禁用系统 CA"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      <SettingItem compatKey="legacy" title="禁用内置 CA" divider>
        <Switch
          size="sm"
          isSelected={disableEmbedCA}
          onChange={(v) => {
            handleConfigChangeWithRestart('disableEmbedCA', v)
          }}
          aria-label="禁用内置 CA"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      <SettingItem compatKey="legacy" title="禁用回环检测" divider>
        <Switch
          size="sm"
          isSelected={disableLoopbackDetector}
          onChange={(v) => {
            handleConfigChangeWithRestart('disableLoopbackDetector', v)
          }}
          aria-label="禁用回环检测"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      {platform == 'linux' && (
        <SettingItem compatKey="legacy" title="禁用 nftables" divider>
          <Switch
            size="sm"
            isSelected={disableNftables}
            onChange={(v) => {
              handleConfigChangeWithRestart('disableNftables', v)
            }}
            aria-label="禁用 nftables"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
      )}
      <SettingItem compatKey="legacy" title="可信路径">
        {safePathsInput.join('') != safePaths.join('') && (
          <Button
            size="sm"
            onPress={() => {
              handleConfigChangeWithRestart('safePaths', safePathsInput)
            }}
            variant="primary"
            data-color="primary"
          >
            确认
          </Button>
        )}
      </SettingItem>
      <EditableList
        items={safePathsInput}
        onChange={(items) => setSafePathsInput(items as string[])}
        divider={false}
      />{' '}
    </SettingCard>
  )
}

export default EnvSetting
