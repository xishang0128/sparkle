import { Button, Tooltip, Switch, Tabs } from '@heroui/react'

import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import useSWR from 'swr'
import { checkAutoRun, disableAutoRun, enableAutoRun, relaunchApp } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { IoIosHelpCircle } from 'react-icons/io'
import ConfirmModal from '../base/base-confirm'
import { notify } from '@renderer/utils/notification'

const GeneralConfig: React.FC = () => {
  const { data: enable, mutate: mutateEnable } = useSWR('checkAutoRun', checkAutoRun)
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    silentStart = false,
    autoCheckUpdate,
    updateChannel = 'stable',
    notificationMode = 'system',
    disableGPU = false,
    disableAnimation = false
  } = appConfig || {}

  const [showRestartConfirm, setShowRestartConfirm] = useState(false)
  const [pendingDisableGPU, setPendingDisableGPU] = useState(disableGPU)

  return (
    <>
      {showRestartConfirm && (
        <ConfirmModal
          title="确定要重启应用吗？"
          description={
            <div>
              <p>修改 GPU 加速设置需要重启应用才能生效</p>
            </div>
          }
          confirmText="重启"
          cancelText="取消"
          onChange={(open) => {
            if (!open) {
              setPendingDisableGPU(disableGPU)
            }
            setShowRestartConfirm(open)
          }}
          onConfirm={async () => {
            await patchAppConfig({ disableGPU: pendingDisableGPU })
            if (!pendingDisableGPU) {
              await patchAppConfig({ disableAnimation: false })
            }
            await relaunchApp()
          }}
        />
      )}
      <SettingCard>
        <SettingItem compatKey="legacy" title="开机自启" divider>
          <Switch
            size="sm"
            isSelected={enable}
            onChange={async (v) => {
              try {
                if (v) {
                  await enableAutoRun()
                } else {
                  await disableAutoRun()
                }
              } catch (e) {
                notify(e, { variant: 'danger' })
              } finally {
                mutateEnable()
              }
            }}
            aria-label="开机自启"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        <SettingItem compatKey="legacy" title="静默启动" divider>
          <Switch
            size="sm"
            isSelected={silentStart}
            onChange={(v) => {
              patchAppConfig({ silentStart: v })
            }}
            aria-label="静默启动"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        <SettingItem compatKey="legacy" title="自动检查更新" divider>
          <Switch
            size="sm"
            isSelected={autoCheckUpdate}
            onChange={(v) => {
              patchAppConfig({ autoCheckUpdate: v })
            }}
            aria-label="自动检查更新"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        <SettingItem compatKey="legacy" title="更新通道" divider>
          <Tabs
            selectedKey={updateChannel}
            onSelectionChange={async (v) => {
              patchAppConfig({ updateChannel: v as AppUpdateChannel })
            }}
            data-color="primary"
            data-size="sm"
            data-full-width={false}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="选项">
                <Tabs.Tab key="stable" id="stable">
                  正式版
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab key="rolling" id="rolling">
                  滚动版
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </SettingItem>
        <SettingItem compatKey="legacy" title="通知形式" divider>
          <Tabs
            selectedKey={notificationMode}
            onSelectionChange={(v) => {
              patchAppConfig({ notificationMode: v as AppNotificationMode })
            }}
            data-color="primary"
            data-size="sm"
            data-full-width={false}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="选项">
                <Tabs.Tab key="system" id="system">
                  系统
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab key="toast" id="toast">
                  应用内
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </SettingItem>

        <SettingItem
          compatKey="legacy"
          title="禁用 GPU 加速"
          actions={
            <Tooltip delay={0}>
              <Button isIconOnly size="sm" variant="ghost" data-color="default">
                <IoIosHelpCircle className="text-lg" />
              </Button>
              <Tooltip.Content>
                {'开启后，应用将禁用 GPU 加速，可能会提高稳定性，但会降低性能'}
              </Tooltip.Content>
            </Tooltip>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={pendingDisableGPU}
            onChange={(v) => {
              setPendingDisableGPU(v)
              setShowRestartConfirm(true)
            }}
            aria-label="禁用 GPU 加速"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        <SettingItem
          compatKey="legacy"
          title="禁用动画"
          actions={
            <Tooltip delay={0}>
              <Button isIconOnly size="sm" variant="ghost" data-color="default">
                <IoIosHelpCircle className="text-lg" />
              </Button>
              <Tooltip.Content>
                {'开启后，应用将减轻绝大部分动画效果，可能会提高性能'}
              </Tooltip.Content>
            </Tooltip>
          }
        >
          <Switch
            size="sm"
            isSelected={disableAnimation}
            onChange={(v) => {
              patchAppConfig({ disableAnimation: v })
            }}
            aria-label="禁用动画"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
      </SettingCard>
    </>
  )
}

export default GeneralConfig
