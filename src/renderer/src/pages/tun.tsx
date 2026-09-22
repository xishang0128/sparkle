import { Button, Spinner, Input, Switch, Tabs } from '@heroui/react'

import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, setupFirewall } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import React, { Key, useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { notify } from '@renderer/utils/notification'

const Tun: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { autoSetDNSMode = 'none' } = appConfig || {}
  const { tun } = controledMihomoConfig || {}
  const [loading, setLoading] = useState(false)
  const {
    device = platform === 'darwin' ? undefined : 'mihomo',
    stack = 'mixed',
    'auto-route': autoRoute = true,
    'auto-redirect': autoRedirect = false,
    'auto-detect-interface': autoDetectInterface = true,
    'dns-hijack': dnsHijack = ['any:53'],
    'route-exclude-address': routeExcludeAddress = [],
    'strict-route': strictRoute = false,
    'disable-icmp-forwarding': disableIcmpForwarding = false,
    mtu = 1500
  } = tun || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    device,
    stack,
    autoRoute,
    autoRedirect,
    autoDetectInterface,
    dnsHijack,
    strictRoute,
    routeExcludeAddress,
    disableIcmpForwarding,
    mtu: Math.min(Math.max(mtu || 1500, 1), 65535)
  })
  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const onSave = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
    setChanged(false)
  }

  return (
    <>
      <BasePage
        title="虚拟网卡设置"
        contentClassName="no-scrollbar"
        header={
          changed && (
            <Button
              size="sm"
              onPress={() =>
                onSave({
                  tun: {
                    device: values.device,
                    stack: values.stack,
                    'auto-route': values.autoRoute,
                    'auto-redirect': values.autoRedirect,
                    'auto-detect-interface': values.autoDetectInterface,
                    'dns-hijack': values.dnsHijack,
                    'strict-route': values.strictRoute,
                    'route-exclude-address': values.routeExcludeAddress,
                    'disable-icmp-forwarding': values.disableIcmpForwarding,
                    mtu: values.mtu
                  }
                })
              }
              variant="primary"
              data-color="primary"
              className="app-nodrag"
            >
              保存
            </Button>
          )
        }
      >
        <SettingCard className="tun-settings">
          {platform === 'win32' && (
            <SettingItem compatKey="legacy" title="重设防火墙" divider>
              <Button
                size="sm"
                onPress={async () => {
                  setLoading(true)
                  try {
                    await setupFirewall()
                    notify('防火墙重设成功')
                    await restartCore()
                  } catch (e) {
                    notify(e, { variant: 'danger' })
                  } finally {
                    setLoading(false)
                  }
                }}
                variant="primary"
                data-color="primary"
                isPending={loading}
                isDisabled={loading}
              >
                {loading ? <Spinner size="sm" color="current" /> : null}重设防火墙
              </Button>
            </SettingItem>
          )}
          {platform === 'darwin' && (
            <SettingItem compatKey="legacy" title="自动设置系统 DNS" divider>
              <Tabs
                selectedKey={autoSetDNSMode}
                onSelectionChange={async (key: Key) => {
                  await patchAppConfig({ autoSetDNSMode: key as 'none' | 'exec' | 'service' })
                }}
                data-color="primary"
                data-size="sm"
                data-full-width={false}
              >
                <Tabs.ListContainer>
                  <Tabs.List aria-label="选项">
                    <Tabs.Tab key="none" id="none">
                      不自动设置
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab key="exec" id="exec">
                      执行命令
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab key="service" id="service">
                      服务模式
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
            </SettingItem>
          )}
          <SettingItem compatKey="legacy" title="Tun 模式堆栈" divider>
            <Tabs
              selectedKey={values.stack}
              onSelectionChange={(key: Key) => setValues({ ...values, stack: key as TunStack })}
              data-color="primary"
              data-size="sm"
              data-full-width={false}
            >
              <Tabs.ListContainer>
                <Tabs.List aria-label="选项">
                  <Tabs.Tab key="gvisor" id="gvisor">
                    gVisor
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab key="mixed" id="mixed">
                    Mixed
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab key="system" id="system">
                    System
                    <Tabs.Indicator />
                  </Tabs.Tab>
                  <Tabs.Tab key="mips" id="mips">
                    MIPS
                    <Tabs.Indicator />
                  </Tabs.Tab>
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          </SettingItem>
          {platform !== 'darwin' && (
            <>
              <SettingItem compatKey="legacy" title="Tun 网卡名称" divider>
                <Input
                  value={values.device}
                  onChange={(event) => {
                    const v = event.target.value
                    setValues({ ...values, device: v })
                  }}
                  className="w-25"
                  fullWidth
                />
              </SettingItem>
              <SettingItem compatKey="legacy" title="严格路由" divider>
                <Switch
                  size="sm"
                  isSelected={values.strictRoute}
                  onChange={(v) => {
                    setValues({ ...values, strictRoute: v })
                  }}
                  aria-label="严格路由"
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </SettingItem>
            </>
          )}
          <SettingItem compatKey="legacy" title="自动设置路由规则" divider>
            <Switch
              size="sm"
              isSelected={values.autoRoute}
              onChange={(v) => {
                setValues({ ...values, autoRoute: v })
              }}
              aria-label="自动设置路由规则"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
          {platform === 'linux' && (
            <SettingItem compatKey="legacy" title="自动设置TCP重定向" divider>
              <Switch
                size="sm"
                isSelected={values.autoRedirect}
                onChange={(v) => {
                  setValues({ ...values, autoRedirect: v })
                }}
                aria-label="自动设置 TCP 重定向"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </SettingItem>
          )}
          <SettingItem compatKey="legacy" title="自动选择流量出口" divider>
            <Switch
              size="sm"
              isSelected={values.autoDetectInterface}
              onChange={(v) => {
                setValues({ ...values, autoDetectInterface: v })
              }}
              aria-label="自动选择流量出口"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
          <SettingItem compatKey="legacy" title="ICMP 转发" divider>
            <Switch
              size="sm"
              isSelected={!values.disableIcmpForwarding}
              onChange={(v) => {
                setValues({ ...values, disableIcmpForwarding: !v })
              }}
              aria-label="ICMP 转发"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
          <SettingItem compatKey="legacy" title="MTU" divider>
            <Input
              type="number"
              value={values.mtu.toString()}
              min={1}
              onChange={(event) => {
                const v = event.target.value
                setValues({
                  ...values,
                  mtu: Math.min(Math.max(parseInt(v) || 1500, 1), 65535)
                })
              }}
              className="w-25"
              fullWidth
            />
          </SettingItem>
          <SettingItem compatKey="legacy" title="DNS 劫持，使用逗号分割多个值" divider>
            <Input
              value={values.dnsHijack.join(',')}
              onChange={(event) => {
                const v = event.target.value
                const arr = v !== '' ? v.split(',') : []
                setValues({ ...values, dnsHijack: arr })
              }}
              className="w-[50%]"
              fullWidth
            />
          </SettingItem>
          <EditableList
            title="排除自定义网段"
            items={values.routeExcludeAddress}
            placeholder="例: 172.20.0.0/16"
            onChange={(list) => setValues({ ...values, routeExcludeAddress: list as string[] })}
            divider={false}
          />
        </SettingCard>
      </BasePage>
    </>
  )
}

export default Tun
