import { Button, Tooltip, InputGroup, Select, Switch, Tabs, ListBox } from '@heroui/react'

import React, { useState, useEffect } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  copyEnv,
  patchControledMihomoConfig,
  restartCore,
  startNetworkDetection,
  stopNetworkDetection
} from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { IoIosHelpCircle } from 'react-icons/io'
import { BiCopy, BiHide, BiShow } from 'react-icons/bi'
import EditableList from '../base/base-list-editor'
import { notify } from '@renderer/utils/notification'

const emptyArray: string[] = []

const AdvancedSettings: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    controlDns = true,
    controlSniff = true,
    pauseSSID,
    autoLightweight = false,
    autoLightweightDelay = 60,
    autoLightweightMode = 'core',
    envType = [platform === 'win32' ? 'powershell' : 'bash'],
    networkDetection = false,
    networkDetectionBypass = ['VMware', 'vEthernet'],
    networkDetectionInterval = 10,
    githubToken = ''
  } = appConfig || {}

  const pauseSSIDArray = pauseSSID ?? emptyArray

  const [pauseSSIDInput, setPauseSSIDInput] = useState(pauseSSIDArray)
  const [githubTokenVisible, setGithubTokenVisible] = useState(false)

  const [bypass, setBypass] = useState(networkDetectionBypass)
  const [interval, setInterval] = useState(Math.max(networkDetectionInterval || 10, 1))

  useEffect(() => {
    setPauseSSIDInput(pauseSSIDArray)
  }, [pauseSSIDArray])

  return (
    <SettingCard header="更多设置">
      <SettingItem
        compatKey="legacy"
        title="GitHub API Token"
        actions={
          <Tooltip delay={0}>
            <Button aria-label="说明" isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>
              {'用于 GitHub 更新检查、下载和 Gist 同步；留空时使用匿名请求'}
            </Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <InputGroup className="w-60" fullWidth>
          <InputGroup.Input
            type={githubTokenVisible ? 'text' : 'password'}
            value={githubToken}
            placeholder="GitHub Personal Access Token"
            onChange={(event) => {
              const value = event.target.value
              void patchAppConfig({ githubToken: value })
            }}
          />
          <InputGroup.Suffix>
            {
              <Button
                aria-label={githubTokenVisible ? '隐藏 GitHub Token' : '显示 GitHub Token'}
                isIconOnly
                size="sm"
                onPress={() => setGithubTokenVisible((visible) => !visible)}
                variant="ghost"
                data-color="default"
              >
                {githubTokenVisible ? (
                  <BiHide className="text-lg" />
                ) : (
                  <BiShow className="text-lg" />
                )}
              </Button>
            }
          </InputGroup.Suffix>
        </InputGroup>
      </SettingItem>
      <SettingItem
        compatKey="legacy"
        title="自动开启轻量模式"
        actions={
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>{'关闭窗口指定时间后自动进入轻量模式'}</Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={autoLightweight}
          onChange={(v) => {
            patchAppConfig({ autoLightweight: v })
          }}
          aria-label="自动开启轻量模式"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      {autoLightweight && (
        <>
          <SettingItem compatKey="legacy" title="轻量模式行为" divider>
            <Tabs
              selectedKey={autoLightweightMode}
              onSelectionChange={(v) => {
                patchAppConfig({ autoLightweightMode: v as 'core' | 'tray' })
                if (v === 'core') {
                  patchAppConfig({ autoLightweightDelay: Math.max(autoLightweightDelay, 5) })
                }
              }}
              data-color="primary"
              data-size="sm"
              data-full-width={false}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="选项">
                  <Tabs.Tab key="core" id="core">
                    仅保留内核
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab key="tray" id="tray">
                    仅关闭渲染进程
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </SettingItem>
          <SettingItem compatKey="legacy" title="自动开启轻量模式延时" divider>
            <InputGroup className="w-25" fullWidth>
              <InputGroup.Input
                type="number"
                value={autoLightweightDelay.toString()}
                onChange={async (event) => {
                  const v = event.target.value
                  let num = parseInt(v)
                  if (isNaN(num)) num = 0
                  const minDelay = autoLightweightMode === 'core' ? 5 : 0
                  if (num < minDelay) num = minDelay
                  await patchAppConfig({ autoLightweightDelay: num })
                }}
              />
              <InputGroup.Suffix>{'秒'}</InputGroup.Suffix>
            </InputGroup>
          </SettingItem>
        </>
      )}
      <SettingItem
        compatKey="legacy"
        title="复制环境变量类型"
        actions={envType.map((type) => (
          <Button
            key={type}
            aria-label={type}
            isIconOnly
            size="sm"
            onPress={() => copyEnv(type)}
            variant="ghost"
            data-color="default"
          >
            <BiCopy className="text-lg" />
          </Button>
        ))}
        divider
      >
        <Select
          aria-label="环境变量类型"
          selectionMode="multiple"
          className={['w-37.5'].filter(Boolean).join(' ')}
          data-size="sm"
          value={Array.from(new Set(envType))}
          onChange={async (v) => {
            try {
              await patchAppConfig({
                envType: Array.from(v) as ('bash' | 'fish' | 'cmd' | 'powershell' | 'nushell')[]
              })
            } catch (e) {
              notify(e, { variant: 'danger' })
            }
          }}
        >
          <Select.Trigger className="data-[hover=true]:bg-default-200">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
            <ListBox>
              <ListBox.Item key="bash" id="bash" textValue="Bash">
                Bash
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="fish" id="fish" textValue="Fish">
                Fish
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="cmd" id="cmd" textValue="CMD">
                CMD
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="powershell" id="powershell" textValue="PowerShell">
                PowerShell
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="nushell" id="nushell" textValue="NuShell">
                NuShell
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </SettingItem>
      <SettingItem compatKey="legacy" title="接管 DNS 设置" divider>
        <Switch
          size="sm"
          isSelected={controlDns}
          onChange={async (v) => {
            try {
              await patchAppConfig({ controlDns: v })
              await patchControledMihomoConfig({})
              await restartCore()
            } catch (e) {
              notify(e, { variant: 'danger' })
            }
          }}
          aria-label="接管 DNS 设置"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      <SettingItem compatKey="legacy" title="接管域名嗅探设置" divider>
        <Switch
          size="sm"
          isSelected={controlSniff}
          onChange={async (v) => {
            try {
              await patchAppConfig({ controlSniff: v })
              await patchControledMihomoConfig({})
              await restartCore()
            } catch (e) {
              notify(e, { variant: 'danger' })
            }
          }}
          aria-label="接管域名嗅探设置"
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
        title="断网时停止内核"
        actions={
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>
              {'开启后，应用会在检测到网络断开时自动停止内核，并在网络恢复后自动重启内核'}
            </Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={networkDetection}
          onChange={(v) => {
            patchAppConfig({ networkDetection: v })
            if (v) {
              startNetworkDetection()
            } else {
              stopNetworkDetection()
            }
          }}
          aria-label="断网时停止内核"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      {networkDetection && (
        <>
          <SettingItem compatKey="legacy" title="断网检测间隔" divider>
            <div className="flex">
              {interval !== networkDetectionInterval && (
                <Button
                  size="sm"
                  onPress={async () => {
                    await patchAppConfig({ networkDetectionInterval: interval })
                    await startNetworkDetection()
                  }}
                  variant="primary"
                  data-color="primary"
                  className="mr-2"
                >
                  确认
                </Button>
              )}
              <InputGroup className="w-25" fullWidth>
                <InputGroup.Input
                  type="number"
                  value={interval.toString()}
                  min={1}
                  onChange={(event) => {
                    const v = event.target.value
                    setInterval(Math.max(parseInt(v) || 10, 1))
                  }}
                />
                <InputGroup.Suffix>{'秒'}</InputGroup.Suffix>
              </InputGroup>
            </div>
          </SettingItem>
          <SettingItem compatKey="legacy" title="绕过检测的接口">
            {bypass.length != networkDetectionBypass.length && (
              <Button
                size="sm"
                onPress={async () => {
                  await patchAppConfig({ networkDetectionBypass: bypass })
                  await startNetworkDetection()
                }}
                variant="primary"
                data-color="primary"
              >
                确认
              </Button>
            )}
          </SettingItem>
          <EditableList items={bypass} onChange={(list) => setBypass(list as string[])} />
        </>
      )}
      <SettingItem compatKey="legacy" title="在特定的 WiFi SSID 下直连">
        {pauseSSIDInput.join('') !== pauseSSIDArray.join('') && (
          <Button
            size="sm"
            onPress={() => {
              patchAppConfig({ pauseSSID: pauseSSIDInput })
            }}
            variant="primary"
            data-color="primary"
          >
            确认
          </Button>
        )}
      </SettingItem>
      <EditableList
        items={pauseSSIDInput}
        onChange={(list) => setPauseSSIDInput(list as string[])}
        divider={false}
      />
    </SettingCard>
  )
}

export default AdvancedSettings
