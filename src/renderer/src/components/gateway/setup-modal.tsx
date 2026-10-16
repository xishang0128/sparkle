import {
  Button,
  Input,
  ListBox,
  Modal,
  Select,
  Separator,
  Spinner,
  Switch,
  Tabs
} from '@heroui/react'
import { probeLanternDHCP } from '@renderer/utils/ipc'
import { isIPv4, isIPv6, type ValidationResult } from '@renderer/utils/validate'
import React, { useEffect, useEffectEvent, useRef, useState } from 'react'
import EditableList from '../base/base-list-editor'

interface Props {
  mode: 'enable' | 'settings'
  options?: LanternOptions
  network: LanternNetwork
  active: boolean
  onClose: () => void
  onEnable: (options: LanternOptions) => Promise<void>
}

const defaultDNS = ['223.5.5.5', '223.6.6.6']

function suggestPool(addresses: string[], gateway: string): [string, string] {
  const cidr = addresses.find((a) => !a.includes(':'))
  if (!cidr) return ['', '']
  const [address, prefix] = cidr.split('/')
  const bits = Number(prefix)
  if (!prefix || !Number.isInteger(bits) || bits < 0 || bits > 30) return ['', '']
  const number = (ip: string): number =>
    ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)
  const format = (ip: number): string =>
    [24, 16, 8, 0].map((shift) => (ip >>> shift) & 255).join('.')
  const ip = number(address)
  const size = 2 ** (32 - bits)
  const subnet = Math.floor(ip / size) * size
  let start = subnet + (size > 8 ? 5 : 1)
  let end = subnet + size - 2
  const reserved = new Set(
    [...addresses.map((a) => a.split('/')[0]), gateway]
      .filter((a) => a && !a.includes(':'))
      .map(number)
  )
  while (start <= end && reserved.has(start)) start++
  while (end >= start && reserved.has(end)) end--
  end = Math.min(end, start + 65535)
  return start <= end ? [format(start), format(end)] : ['', '']
}

export default function GatewaySetup({
  mode,
  options,
  network,
  active,
  onClose,
  onEnable
}: Props): React.JSX.Element {
  const candidates = network.interfaces.filter((i) => i.physical && i.lan_capable)
  const [step, setStep] = useState(
    mode === 'settings' && (options?.interface || candidates.length === 1) ? 2 : 0
  )
  const [tab, setTab] = useState('ipv4')
  const [iface, setIface] = useState(
    options?.interface || (candidates.length === 1 ? candidates[0].name : '')
  )
  const routes = (name: string): LanternNetwork['default_routes'] =>
    [...network.default_routes]
      .filter((r) => r.interface === name)
      .sort((a, b) => a.metric - b.metric)
  const initialGateway4 =
    options?.gateway_ipv4 || routes(iface).find((r) => !r.gateway.includes(':'))?.gateway || ''
  const [initialStart, initialEnd] = suggestPool(
    network.interfaces.find((i) => i.name === iface)?.addresses || [],
    initialGateway4
  )
  const [gateway4, setGateway4] = useState(initialGateway4)
  const [gateway6, setGateway6] = useState(
    options?.gateway_ipv6 || routes(iface).find((r) => r.gateway.includes(':'))?.gateway || ''
  )
  const [raEnabled, setRAEnabled] = useState(
    options?.ra.enabled ?? routes(iface).some((r) => r.gateway.includes(':'))
  )
  const [poolStart, setPoolStart] = useState(options?.dhcp?.pool_start || initialStart)
  const [poolEnd, setPoolEnd] = useState(options?.dhcp?.pool_end || initialEnd)
  const [dns, setDNS] = useState(options?.dhcp?.dns ?? defaultDNS)
  const [targets, setTargets] = useState(options?.ra.targets || [])
  const [rdnss, setRDNSS] = useState(
    options?.ra.rdnss ?? network.dns?.filter((ip) => ip.includes(':')) ?? []
  )
  const [probe, setProbe] = useState<LanternProbe>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selected = network.interfaces.find((i) => i.name === iface)
  const local4 = selected?.addresses.find((a) => !a.includes(':')) || ''

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const detect = async (): Promise<void> => {
    setStep(1)
    setProbe(undefined)
    await run(async () => {
      const result = await probeLanternDHCP(iface)
      setProbe(result)
      if (result.truncated || !result.discoveries_sent)
        throw new Error('探测未完整完成，请重新检测')
      if (result.servers.length > 0) return
      try {
        await enable()
      } catch (e) {
        setStep(2)
        throw e
      }
    })
  }

  const enable = async (): Promise<void> => {
    if (!poolStart || !poolEnd) throw new Error('接口没有可用于 DHCP 的 IPv4 地址范围')
    const addresses = dns.map((ip) => ip.trim()).filter(Boolean)
    if (!addresses.length) throw new Error('请至少填写一个 IPv4 DNS 地址')
    if (addresses.some((ip) => !isIPv4(ip).ok)) throw new Error('请填写有效的 IPv4 DNS 地址')
    await onEnable({
      gateway_mode: true,
      interface: iface,
      ...(gateway4.trim() && { gateway_ipv4: gateway4.trim() }),
      ...(raEnabled && gateway6.trim() && { gateway_ipv6: gateway6.trim() }),
      discovery: { enabled: true, mdns: true, ssdp: true },
      ra: {
        enabled: raEnabled,
        targets: targets.map((ip) => ip.trim()).filter(Boolean),
        rdnss: rdnss.map((ip) => ip.trim()).filter(Boolean)
      },
      dhcp: {
        enabled: true,
        exclusive_pool: true,
        ...(poolStart.trim() && { pool_start: poolStart.trim() }),
        ...(poolEnd.trim() && { pool_end: poolEnd.trim() }),
        dns: addresses,
        allowed_macs: [],
        gateway_macs: options?.interface === iface ? options.dhcp?.gateway_macs || [] : [],
        reservations: options?.interface === iface ? options.dhcp?.reservations || [] : []
      }
    })
    onClose()
  }

  const autoDetect = useEffectEvent(detect)
  const attempted = useRef(false)
  useEffect(() => {
    if (mode === 'enable' && candidates.length === 1 && iface && !active && !attempted.current) {
      attempted.current = true
      void autoDetect()
    }
  }, [mode, candidates.length, iface, active])

  const field = (
    label: string,
    value: string,
    change: (value: string) => void,
    placeholder?: string
  ): React.ReactNode => (
    <label className="flex min-w-0 items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-default-500">{label}</span>
      <Input
        aria-label={label}
        className="min-w-0 flex-1"
        value={value}
        placeholder={placeholder}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
      />
    </label>
  )

  const listField = (
    label: string,
    values: string[],
    change: (values: string[]) => void,
    placeholder: string,
    validate: (value: string) => ValidationResult
  ): React.ReactNode => (
    <div className="flex min-w-0 items-start gap-3 text-sm">
      <span className="w-20 shrink-0 pt-3 text-default-500">{label}</span>
      <fieldset aria-label={label} disabled={busy} className="min-w-0 flex-1">
        <EditableList
          items={values}
          onChange={(items) => change(items as string[])}
          placeholder={placeholder}
          validate={(value) => validate(value.trim())}
          divider={false}
        />
      </fieldset>
    </div>
  )

  return (
    <Modal>
      <Modal.Backdrop
        isOpen
        onOpenChange={(open) => {
          if (!open && !busy) onClose()
        }}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside" className="h-full">
          <Modal.Dialog className="w-140 max-w-[calc(100vw-32px)]">
            <Modal.Header className="app-drag flex-col gap-1">
              <Modal.Heading>{mode === 'settings' ? '网关设置' : '启用网关模式'}</Modal.Heading>
              <p className="text-xs text-default-500">
                {step === 0
                  ? '选择局域网接口'
                  : step === 1
                    ? '检测当前 DHCP 服务器'
                    : '配置网络参数'}
              </p>
            </Modal.Header>
            <Modal.Body className="space-y-4 py-4">
              {step === 0 && (
                <>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="w-20 shrink-0 text-default-500">网络接口</span>
                    <Select
                      aria-label="局域网接口"
                      className="min-w-0 flex-1"
                      data-size="sm"
                      value={iface || null}
                      isDisabled={busy}
                      onChange={(value) => {
                        const next = String(value)
                        if (next === iface) return
                        const nextRoutes = routes(next)
                        const nextGateway =
                          nextRoutes.find((r) => !r.gateway.includes(':'))?.gateway || ''
                        const [start, end] = suggestPool(
                          network.interfaces.find((i) => i.name === next)?.addresses || [],
                          nextGateway
                        )
                        setIface(next)
                        setGateway4(nextGateway)
                        setGateway6(nextRoutes.find((r) => r.gateway.includes(':'))?.gateway || '')
                        setRAEnabled(nextRoutes.some((r) => r.gateway.includes(':')))
                        setPoolStart(start)
                        setPoolEnd(end)
                        setDNS(defaultDNS)
                        setTargets([])
                        setRDNSS(network.dns?.filter((ip) => ip.includes(':')) || [])
                      }}
                    >
                      <Select.Trigger>
                        <Select.Value>{iface || '选择接口'}</Select.Value>
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {network.interfaces
                            .filter((i) => i.lan_capable)
                            .map((i) => (
                              <ListBox.Item key={i.name} id={i.name} textValue={i.name}>
                                {i.name}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <p className="text-xs text-default-500">
                    启用前检测已有 DHCP 服务器，网络参数自动识别；IPv6 RA 接管可在设置中关闭。
                  </p>
                </>
              )}
              {step === 1 && (
                <div className="space-y-4 py-4">
                  {busy ? (
                    <div className="flex items-center gap-3 text-sm">
                      <Spinner size="sm" />
                      <span>正在检测，请稍候…</span>
                    </div>
                  ) : probe?.servers.length ? (
                    <>
                      <p className="text-sm text-warning">检测到 DHCP 服务器，无法启用网关模式。</p>
                      <div className="space-y-2">
                        {probe.servers.map((s) => (
                          <div
                            key={`${s.address}/${s.mac}`}
                            className="rounded-lg bg-default-100 p-3 text-sm"
                          >
                            <p>{s.address}</p>
                            <p className="mt-1 break-all text-xs text-default-500">
                              {s.mac}
                              {s.relay_ip ? ` · 中继 ${s.relay_ip}` : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-default-500">
                        请关闭以上设备的 DHCP 服务后重新检测。
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-default-500">本轮检测尚未完成。</p>
                  )}
                </div>
              )}
              {step === 2 && (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="w-20 shrink-0 text-default-500">本机地址</span>
                    <span className="min-w-0 break-all">
                      {local4 || '未配置 IPv4'} · {iface}
                    </span>
                  </div>
                  <Tabs
                    className="inline-flex w-auto"
                    selectedKey={tab}
                    onSelectionChange={(key) => setTab(String(key))}
                    data-size="sm"
                    data-color="primary"
                  >
                    <Tabs.ListContainer>
                      <Tabs.List aria-label="网络参数">
                        <Tabs.Tab id="ipv4">
                          IPv4
                          <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="ipv6">
                          IPv6
                          <Tabs.Indicator />
                        </Tabs.Tab>
                      </Tabs.List>
                    </Tabs.ListContainer>
                  </Tabs>
                  {tab === 'ipv4' ? (
                    <div className="space-y-3">
                      {field('主路由', gateway4, setGateway4, '自动识别')}
                      {listField('DNS', dns, setDNS, '添加 DNS 地址', isIPv4)}
                      {field('起始地址', poolStart, setPoolStart)}
                      {field('结束地址', poolEnd, setPoolEnd)}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>IPv6 RA 接管</span>
                        <Switch
                          size="sm"
                          aria-label="IPv6 RA 接管"
                          isSelected={raEnabled}
                          isDisabled={busy}
                          onChange={setRAEnabled}
                        >
                          <Switch.Content>
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                          </Switch.Content>
                        </Switch>
                      </div>
                      {raEnabled && (
                        <>
                          {field('主路由', gateway6, setGateway6, '自动识别')}
                          {listField('DNS', rdnss, setRDNSS, '添加 IPv6 DNS 地址（可选）', isIPv6)}
                          {listField(
                            '定向宣告',
                            targets,
                            setTargets,
                            '添加设备 fe80:: 地址（可选）',
                            isIPv6
                          )}
                          <p className="text-xs text-default-500">
                            定向宣告留空时向局域网发送 RA。是否经过本机，以实际观察到的流量为准。
                          </p>
                        </>
                      )}
                      {!raEnabled && (
                        <p className="text-xs text-default-500">
                          关闭后仅提供 IPv4 DHCP，不发送 IPv6 RA。
                        </p>
                      )}
                    </div>
                  )}
                  {active && (
                    <p className="text-xs text-default-500">
                      保存后立即生效，DHCP 参数在设备续租后应用。
                    </p>
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="wrap-break-word text-sm text-danger">
                  {error}
                </p>
              )}
            </Modal.Body>
            <Separator className="shrink-0" />
            <Modal.Footer className="shrink-0 justify-between gap-2 pt-4">
              <Button size="sm" variant="secondary" isDisabled={busy} onPress={onClose}>
                {active ? '关闭' : '取消'}
              </Button>
              {active ? (
                <Button
                  size="sm"
                  variant="primary"
                  isPending={busy}
                  isDisabled={busy}
                  onPress={() => run(enable)}
                >
                  保存
                </Button>
              ) : (
                <div className="flex gap-2">
                  {step > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      isDisabled={busy}
                      onPress={() => {
                        setStep(0)
                        setError('')
                      }}
                    >
                      返回
                    </Button>
                  )}
                  {step === 0 ? (
                    <Button
                      size="sm"
                      variant="primary"
                      isDisabled={busy || !iface}
                      isPending={busy}
                      onPress={detect}
                    >
                      检测并启用
                    </Button>
                  ) : step === 1 ? (
                    <Button
                      size="sm"
                      variant="primary"
                      isPending={busy}
                      isDisabled={busy}
                      onPress={detect}
                    >
                      重新检测
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      isPending={busy}
                      isDisabled={busy}
                      onPress={() => run(enable)}
                    >
                      完成并启用
                    </Button>
                  )}
                </div>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
