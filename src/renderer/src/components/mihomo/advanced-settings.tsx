import { Button, Tooltip, Input, Switch, Tabs } from '@heroui/react'

import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import InterfaceSelect from '../base/interface-select'
import { restartCore } from '@renderer/utils/ipc'
import { useState } from 'react'
import { IoIosHelpCircle } from 'react-icons/io'

const AdvancedSetting: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    'unified-delay': unifiedDelay,
    'tcp-concurrent': tcpConcurrent,
    'disable-keep-alive': disableKeepAlive = false,
    'find-process-mode': findProcessMode = 'always',
    'interface-name': interfaceName = '',
    'keep-alive-idle': idle = 15,
    'keep-alive-interval': interval = 15,
    profile = {},
    tun = {}
  } = controledMihomoConfig || {}
  const { 'store-selected': storeSelected, 'store-fake-ip': storeFakeIp } = profile
  const { device = 'mihomo' } = tun

  const [idleInput, setIdleInput] = useState(idle)
  const [intervalInput, setIntervalInput] = useState(interval)

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <SettingCard header="高级设置">
      <SettingItem compatKey="legacy" title="查找进程" divider>
        <Tabs
          selectedKey={findProcessMode}
          onSelectionChange={(key) => {
            onChangeNeedRestart({ 'find-process-mode': key as FindProcessMode })
          }}
          data-color="primary"
          data-size="sm"
          data-full-width={false}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="选项">
              <Tabs.Tab key="strict" id="strict">
                自动
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab key="off" id="off">
                关闭
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab key="always" id="always">
                开启
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </SettingItem>
      <SettingItem compatKey="legacy" title="存储选择节点" divider>
        <Switch
          size="sm"
          isSelected={storeSelected}
          onChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-selected': v } })
          }}
          aria-label="存储选择节点"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      <SettingItem compatKey="legacy" title="存储 FakeIP" divider>
        <Switch
          size="sm"
          isSelected={storeFakeIp}
          onChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-fake-ip': v } })
          }}
          aria-label="存储 FakeIP"
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
        title="使用 RTT 延迟测试"
        actions={
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>
              {'开启后会使用统一延迟测试来获取节点延迟，以消除不同节点握手时间的影响'}
            </Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={unifiedDelay}
          onChange={(v) => {
            onChangeNeedRestart({ 'unified-delay': v })
          }}
          aria-label="使用 RTT 延迟测试"
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
        title="TCP 并发"
        actions={
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>
              {'对 dns 解析出的多个 IP 地址进行 TCP 并发连接，使用握手时间最短的连接'}
            </Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={tcpConcurrent}
          onChange={(v) => {
            onChangeNeedRestart({ 'tcp-concurrent': v })
          }}
          aria-label="TCP 并发"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      <SettingItem compatKey="legacy" title="禁用 TCP Keep Alive" divider>
        <Switch
          size="sm"
          isSelected={disableKeepAlive}
          onChange={(v) => {
            onChangeNeedRestart({ 'disable-keep-alive': v })
          }}
          aria-label="禁用 TCP Keep Alive"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      <SettingItem compatKey="legacy" title="TCP Keep Alive 间隔" divider>
        <div className="flex">
          {intervalInput !== interval && (
            <Button
              size="sm"
              onPress={async () => {
                await onChangeNeedRestart({ 'keep-alive-interval': intervalInput })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <Input
            type="number"
            value={intervalInput.toString()}
            min={0}
            onChange={(event) => {
              const v = event.target.value
              setIntervalInput(parseInt(v) || 0)
            }}
            className="w-25"
            fullWidth
          />
        </div>
      </SettingItem>
      <SettingItem compatKey="legacy" title="TCP Keep Alive 空闲" divider>
        <div className="flex">
          {idleInput !== idle && (
            <Button
              size="sm"
              onPress={async () => {
                await onChangeNeedRestart({ 'keep-alive-idle': idleInput })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <Input
            type="number"
            value={idleInput.toString()}
            min={0}
            onChange={(event) => {
              const v = event.target.value
              setIdleInput(parseInt(v) || 0)
            }}
            className="w-25"
            fullWidth
          />
        </div>
      </SettingItem>
      <SettingItem compatKey="legacy" title="指定出站接口">
        <InterfaceSelect
          value={interfaceName}
          exclude={[device, 'lo']}
          onChange={(iface) => onChangeNeedRestart({ 'interface-name': iface })}
        />
      </SettingItem>
    </SettingCard>
  )
}

export default AdvancedSetting
