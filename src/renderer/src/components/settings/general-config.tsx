import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Switch, Tab, Tabs, Tooltip } from '@heroui/react'
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
            onValueChange={async (v) => {
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
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="静默启动" divider>
          <Switch
            size="sm"
            isSelected={silentStart}
            onValueChange={(v) => {
              patchAppConfig({ silentStart: v })
            }}
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="自动检查更新" divider>
          <Switch
            size="sm"
            isSelected={autoCheckUpdate}
            onValueChange={(v) => {
              patchAppConfig({ autoCheckUpdate: v })
            }}
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="更新通道" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={updateChannel}
            onSelectionChange={async (v) => {
              patchAppConfig({ updateChannel: v as AppUpdateChannel })
            }}
          >
            <Tab key="stable" title="正式版" />
            <Tab key="rolling" title="滚动版" />
          </Tabs>
        </SettingItem>
        <SettingItem compatKey="legacy" title="通知形式" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={notificationMode}
            onSelectionChange={(v) => {
              patchAppConfig({ notificationMode: v as AppNotificationMode })
            }}
          >
            <Tab key="system" title="系统" />
            <Tab key="toast" title="应用内" />
          </Tabs>
        </SettingItem>

        <SettingItem
          compatKey="legacy"
          title="禁用 GPU 加速"
          actions={
            <Tooltip content="开启后，应用将禁用 GPU 加速，可能会提高稳定性，但会降低性能">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={pendingDisableGPU}
            onValueChange={(v) => {
              setPendingDisableGPU(v)
              setShowRestartConfirm(true)
            }}
          />
        </SettingItem>
        <SettingItem
          compatKey="legacy"
          title="禁用动画"
          actions={
            <Tooltip content="开启后，应用将减轻绝大部分动画效果，可能会提高性能">
              <Button isIconOnly size="sm" variant="light">
                <IoIosHelpCircle className="text-lg" />
              </Button>
            </Tooltip>
          }
        >
          <Switch
            size="sm"
            isSelected={disableAnimation}
            onValueChange={(v) => {
              patchAppConfig({ disableAnimation: v })
            }}
          />
        </SettingItem>
      </SettingCard>
    </>
  )
}

export default GeneralConfig
