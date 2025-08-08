import { Button, Input, Switch, Tab, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, setupFirewall } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import React, { Key, useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'

const Tun: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { autoSetDNS = true, controlTun = true } = appConfig || {}
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
    mtu
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
        header={
          controlTun && changed && (
            <Button
              size="sm"
              className="app-nodrag"
              color="primary"
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
                    mtu: values.mtu
                  }
                })
              }
            >
              保存
            </Button>
          )
        }
      >
        <SettingCard className="tun-settings">
          {platform === 'win32' && (
            <SettingItem title="重设防火墙" divider>
              <Button
                size="sm"
                color="primary"
                isLoading={loading}
                onPress={async () => {
                  setLoading(true)
                  try {
                    await setupFirewall()
                    new Notification('防火墙重设成功')
                    await restartCore()
                  } catch (e) {
                    alert(e)
                  } finally {
                    setLoading(false)
                  }
                }}
              >
                重设防火墙
              </Button>
            </SettingItem>
          )}
          {platform === 'darwin' && (
            <SettingItem title="自动设置系统DNS" divider>
              <Switch
                size="sm"
                isSelected={autoSetDNS}
                onValueChange={async (v) => {
                  await patchAppConfig({ autoSetDNS: v })
                }}
              />
            </SettingItem>
          )}
          <SettingItem title="Tun 模式堆栈" divider>
            <Tabs
              size="sm"
              color="primary"
              selectedKey={values.stack}
              onSelectionChange={(key: Key) => setValues({ ...values, stack: key as TunStack })}
            >
              <Tab key="gvisor" title="gVisor" />
              <Tab key="mixed" title="Mixed" />
              <Tab key="system" title="System" />
            </Tabs>
          </SettingItem>
          {platform !== 'darwin' && (
            <>
              <SettingItem title="Tun 网卡名称" divider>
                <Input
                  size="sm"
                  className="w-[100px]"
                  value={values.device}
                  onValueChange={(v) => {
                    setValues({ ...values, device: v })
                  }}
                />
              </SettingItem>
              <SettingItem title="严格路由" divider>
                <Switch
                  size="sm"
                  isSelected={values.strictRoute}
                  onValueChange={(v) => {
                    setValues({ ...values, strictRoute: v })
                  }}
                />
              </SettingItem>
            </>
          )}
          <SettingItem title="自动设置路由规则" divider>
            <Switch
              size="sm"
              isSelected={values.autoRoute}
              onValueChange={(v) => {
                setValues({ ...values, autoRoute: v })
              }}
            />
          </SettingItem>
          {platform === 'linux' && (
            <SettingItem title="自动设置TCP重定向" divider>
              <Switch
                size="sm"
                isSelected={values.autoRedirect}
                onValueChange={(v) => {
                  setValues({ ...values, autoRedirect: v })
                }}
              />
            </SettingItem>
          )}
          <SettingItem title="自动选择流量出口接口" divider>
            <Switch
              size="sm"
              isSelected={values.autoDetectInterface}
              onValueChange={(v) => {
                setValues({ ...values, autoDetectInterface: v })
              }}
            />
          </SettingItem>
          <SettingItem title="MTU" divider>
            <Input
              size="sm"
              type="number"
              className="w-[100px]"
              value={values.mtu.toString()}
              onValueChange={(v) => {
                setValues({ ...values, mtu: parseInt(v) })
              }}
            />
          </SettingItem>
          <SettingItem title="DNS 劫持，使用逗号分割多个值" divider>
            <Input
              size="sm"
              className="w-[50%]"
              value={values.dnsHijack.join(',')}
              onValueChange={(v) => {
                const arr = v !== '' ? v.split(',') : []
                setValues({ ...values, dnsHijack: arr })
              }}
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
