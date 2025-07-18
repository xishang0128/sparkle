import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import InterfaceSelect from '../base/interface-select'
import { restartCore } from '@renderer/utils/ipc'
import { Button, Input, Select, SelectItem, Switch, Tooltip } from '@heroui/react'
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
    'global-client-fingerprint': globalClientFingerprint = '',
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
    <SettingCard title="高级设置">
      <SettingItem title="存储选择节点" divider>
        <Switch
          size="sm"
          isSelected={storeSelected}
          onValueChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-selected': v } })
          }}
        />
      </SettingItem>
      <SettingItem title="存储 FakeIP" divider>
        <Switch
          size="sm"
          isSelected={storeFakeIp}
          onValueChange={(v) => {
            onChangeNeedRestart({ profile: { 'store-fake-ip': v } })
          }}
        />
      </SettingItem>
      <SettingItem
        title="使用 RTT 延迟测试"
        actions={
          <Tooltip content="开启后会使用统一延迟测试来获取节点延迟，以消除不同节点握手时间的影响">
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={unifiedDelay}
          onValueChange={(v) => {
            onChangeNeedRestart({ 'unified-delay': v })
          }}
        />
      </SettingItem>
      <SettingItem
        title="TCP 并发"
        actions={
          <Tooltip content="对 dns 解析出的多个 IP 地址进行 TCP 并发连接，使用握手时间最短的连接">
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={tcpConcurrent}
          onValueChange={(v) => {
            onChangeNeedRestart({ 'tcp-concurrent': v })
          }}
        />
      </SettingItem>
      <SettingItem title="禁用 TCP Keep Alive" divider>
        <Switch
          size="sm"
          isSelected={disableKeepAlive}
          onValueChange={(v) => {
            onChangeNeedRestart({ 'disable-keep-alive': v })
          }}
        />
      </SettingItem>
      <SettingItem title="TCP Keep Alive 间隔" divider>
        <div className="flex">
          {intervalInput !== interval && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={async () => {
                await onChangeNeedRestart({ 'keep-alive-interval': intervalInput })
              }}
            >
              确认
            </Button>
          )}
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={intervalInput.toString()}
            min={0}
            onValueChange={(v) => {
              setIntervalInput(parseInt(v) || 0)
            }}
          />
        </div>
      </SettingItem>
      <SettingItem title="TCP Keep Alive 空闲" divider>
        <div className="flex">
          {idleInput !== idle && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              onPress={async () => {
                await onChangeNeedRestart({ 'keep-alive-idle': idleInput })
              }}
            >
              确认
            </Button>
          )}
          <Input
            size="sm"
            type="number"
            className="w-[100px]"
            value={idleInput.toString()}
            min={0}
            onValueChange={(v) => {
              setIdleInput(parseInt(v) || 0)
            }}
          />
        </div>
      </SettingItem>
      <SettingItem title="uTLS 指纹" divider>
        <Select
          size="sm"
          className="w-[150px]"
          selectedKeys={new Set([globalClientFingerprint])}
          disallowEmptySelection={true}
          onSelectionChange={(v) => {
            onChangeNeedRestart({ 'global-client-fingerprint': v.currentKey as Fingerprints })
          }}
        >
          <SelectItem key="">禁用</SelectItem>
          <SelectItem key="random">随机</SelectItem>
          <SelectItem key="chrome">Chrome</SelectItem>
          <SelectItem key="firefox">Firefox</SelectItem>
          <SelectItem key="safari">Safari</SelectItem>
          <SelectItem key="ios">iOS</SelectItem>
          <SelectItem key="android">Android</SelectItem>
          <SelectItem key="edge">Edge</SelectItem>
          <SelectItem key="360">360</SelectItem>
          <SelectItem key="qq">QQ</SelectItem>
        </Select>
      </SettingItem>
      <SettingItem title="查找进程" divider>
        <Select
          classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
          className="w-[150px]"
          size="sm"
          selectedKeys={new Set([findProcessMode])}
          disallowEmptySelection={true}
          onSelectionChange={(v) => {
            onChangeNeedRestart({ 'find-process-mode': v.currentKey as FindProcessMode })
          }}
        >
          <SelectItem key="strict">自动</SelectItem>
          <SelectItem key="off">关闭</SelectItem>
          <SelectItem key="always">开启</SelectItem>
        </Select>
      </SettingItem>
      <SettingItem title="指定出站接口">
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
