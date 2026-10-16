import {
  Button,
  Card,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Separator,
  Surface,
  Switch
} from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import GatewaySetup from '@renderer/components/gateway/setup-modal'
import {
  gatewayDeviceName as deviceName,
  gatewayDevices as leasedDevices
} from '@renderer/utils/gateway-devices'
import {
  getLanternInterfaces,
  getLanternStatus,
  resumeLanternDHCP,
  setLanternGatewayDevices,
  startLantern,
  configureLantern
} from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { LuMonitor, LuNetwork, LuSettings2 } from 'react-icons/lu'
import useSWR from 'swr'

export default function Gateway(): React.JSX.Element {
  const { data, error, mutate } = useSWR('lantern-status', getLanternStatus, {
    refreshInterval: 2000,
    shouldRetryOnError: false
  })
  const { data: network, error: networkError } = useSWR(
    'lantern-interfaces',
    getLanternInterfaces,
    { shouldRetryOnError: false }
  )
  const [setup, setSetup] = useState(false)
  const [selected, setSelected] = useState('')
  const [sort, setSort] = useState('address')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const gateway = Boolean(data?.gateway_mode)
  const available = Boolean(data?.supported && network && !error && !networkError)
  const problem = actionError || String(error || networkError || '')
  const clients = leasedDevices(data)
  const devices = clients
    .filter((d) =>
      `${deviceName(d)} ${d.mac} ${d.addresses.map((a) => a.ip).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) =>
      (sort === 'name'
        ? deviceName(a)
        : a.addresses.find((ip) => !ip.ip.includes(':'))?.ip || a.addresses[0]?.ip || a.mac
      ).localeCompare(
        sort === 'name'
          ? deviceName(b)
          : b.addresses.find((ip) => !ip.ip.includes(':'))?.ip || b.addresses[0]?.ip || b.mac,
        undefined,
        { numeric: true }
      )
    )
  const device = devices.find((d) => `${d.interface}/${d.mac}` === selected) || devices[0]
  const details = device
    ? [
        [
          'DHCP 主机名',
          device.evidence.find((e) => e.field === 'hostname' && e.source.startsWith('dhcp'))?.value
        ],
        ['DHCP 标识', device.evidence.find((e) => e.field === 'vendor_class')?.value],
        ['IP 地址', device.addresses.map((a) => a.ip).join('、')],
        ['MAC 地址', device.mac]
      ].filter(([, value]) => value)
    : []
  const act = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setActionError('')
    try {
      await fn()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e))
      await mutate().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  const messages = Array.from(
    new Set(
      [
        ...(data?.status.problems || []),
        data?.status.ra.suspended_reason,
        data?.status.ra.last_error,
        data?.status.dhcp.paused_reason,
        data?.status.dhcp.last_error
      ].filter(Boolean)
    )
  )

  return (
    <BasePage
      title="网关模式"
      contentClassName="no-scrollbar"
      header={
        <Button
          aria-label="网关设置"
          size="sm"
          variant="ghost"
          data-color="default"
          isIconOnly
          className="app-nodrag"
          isDisabled={busy || !available}
          onPress={() => setSetup(true)}
        >
          <LuSettings2 className="text-lg" />
        </Button>
      }
    >
      <Surface variant="transparent" className="flex h-full min-h-0 flex-col p-2">
        <Surface variant="transparent" className="mb-3 flex items-center justify-between gap-3">
          <Surface variant="transparent" className="flex items-baseline gap-2">
            <h2 className="text-base font-medium">设备</h2>
            <span className="text-xs text-default-500">{clients.length}</span>
          </Surface>
          <Select
            aria-label="设备排序"
            className="w-32"
            data-size="sm"
            value={sort}
            onChange={(value) => setSort(String(value))}
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="address" textValue="按地址排序">
                  按地址排序
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="name" textValue="按名称排序">
                  按名称排序
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </Surface>
        {problem && (
          <p role="alert" className="mb-3 wrap-break-word text-xs text-danger">
            {problem}
          </p>
        )}
        {data && !data.supported && (
          <p className="mb-3 text-xs text-warning">当前平台暂不支持网关模式</p>
        )}
        {messages.length > 0 && (
          <Surface variant="transparent" className="mb-3 space-y-1 text-xs text-warning">
            {messages.map((message) => (
              <p key={message} className="wrap-break-word">
                {message}
              </p>
            ))}
            {data?.status.dhcp.paused_reason && gateway && (
              <Button
                size="sm"
                variant="secondary"
                isDisabled={busy}
                onPress={() =>
                  act(async () => {
                    await mutate(await resumeLanternDHCP(), false)
                  })
                }
              >
                重新探测并恢复 DHCP
              </Button>
            )}
          </Surface>
        )}
        <Surface
          variant="transparent"
          className="grid min-h-0 flex-1 grid-cols-[minmax(140px,0.85fr)_minmax(0,1.15fr)] gap-3"
        >
          <Card className="min-h-0 min-w-0 backdrop-blur-md">
            <Card.Content className="flex min-h-0 flex-1 flex-col p-3">
              <Input
                aria-label="搜索设备"
                placeholder="搜索设备"
                className="mb-2 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Surface
                variant="transparent"
                className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
              >
                {devices.length ? (
                  <ListBox
                    aria-label="局域网设备"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set(device ? [`${device.interface}/${device.mac}`] : [])}
                    onSelectionChange={(keys) => {
                      if (keys === 'all') return
                      const key = Array.from(keys)[0]
                      if (key !== undefined) setSelected(String(key))
                    }}
                    className="space-y-1 p-0"
                  >
                    {devices.map((d) => (
                      <ListBox.Item
                        id={`${d.interface}/${d.mac}`}
                        key={`${d.interface}/${d.mac}`}
                        textValue={deviceName(d)}
                        className="gap-2 rounded-lg px-2 py-3 aria-selected:bg-accent/15"
                      >
                        <LuMonitor className="shrink-0 text-xl text-default-500" />
                        <Surface variant="transparent" className="min-w-0">
                          <Label className="block truncate text-sm">{deviceName(d)}</Label>
                          <Description className="mt-0.5 truncate text-xs text-default-500">
                            {d.addresses.find((a) => !a.ip.includes(':'))?.ip ||
                              d.addresses[0]?.ip ||
                              d.mac}
                          </Description>
                        </Surface>
                      </ListBox.Item>
                    ))}
                  </ListBox>
                ) : (
                  <Surface
                    variant="transparent"
                    className="flex h-full flex-col items-center justify-center gap-3 py-6 text-center text-default-500"
                  >
                    <LuNetwork className="text-3xl" />
                    <p className="text-xs">
                      {search
                        ? '未找到设备'
                        : gateway
                          ? '等待设备获取 DHCP 租约'
                          : '开启网关后显示已分配设备'}
                    </p>
                  </Surface>
                )}
              </Surface>
            </Card.Content>
          </Card>
          <Card className="min-h-0 min-w-0 backdrop-blur-md">
            <Card.Content className="min-h-0 overflow-y-auto p-3 custom-scrollbar">
              {device ? (
                <>
                  <Surface
                    variant="transparent"
                    className="flex items-center justify-between gap-3"
                  >
                    <Surface
                      variant="transparent"
                      className="flex min-w-0 flex-1 items-center gap-2"
                    >
                      <LuMonitor className="shrink-0 text-2xl text-default-500" />
                      <Surface variant="transparent" className="min-w-0">
                        <Card.Title
                          className="truncate text-sm font-medium"
                          title={deviceName(device)}
                        >
                          {deviceName(device)}
                        </Card.Title>
                        <Card.Description className="mt-0.5 break-all text-xs text-default-500">
                          {device.addresses[0]?.ip}
                        </Card.Description>
                      </Surface>
                    </Surface>
                    <Switch
                      className="shrink-0 flex-row items-center gap-2"
                      size="sm"
                      aria-label={`${deviceName(device)} 接管流量`}
                      isSelected={Boolean(data?.options?.dhcp?.gateway_macs?.includes(device.mac))}
                      isDisabled={busy || !gateway || !data?.status.dhcp.running}
                      onChange={(enabled) =>
                        void act(async () => {
                          const macs = (data?.options?.dhcp?.gateway_macs || []).filter(
                            (mac) => mac !== device.mac
                          )
                          if (enabled) macs.push(device.mac)
                          await mutate(await setLanternGatewayDevices(macs), false)
                        })
                      }
                    >
                      <Label className="text-xs text-default-500">接管流量</Label>
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                  </Surface>
                  <section className="mt-4">
                    <h4 className="text-xs font-medium text-accent">详情</h4>
                    <Separator className="my-2" />
                    <dl className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-xs">
                      {details.map(([label, value]) => (
                        <React.Fragment key={label}>
                          <dt className="text-default-500">{label}</dt>
                          <dd className="break-all text-right">{value}</dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  </section>
                </>
              ) : (
                <Surface
                  variant="transparent"
                  className="flex h-full items-center justify-center text-xs text-default-500"
                >
                  选择设备查看详情
                </Surface>
              )}
            </Card.Content>
          </Card>
        </Surface>
      </Surface>
      {setup && network && (
        <GatewaySetup
          mode="settings"
          options={data?.options}
          network={network}
          active={gateway}
          onClose={() => setSetup(false)}
          onEnable={async (options) => {
            try {
              await mutate(await (gateway ? configureLantern : startLantern)(options), false)
            } catch (e) {
              await mutate().catch(() => {})
              throw e
            }
          }}
        />
      )}
    </BasePage>
  )
}
