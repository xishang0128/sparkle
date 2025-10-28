import { Button, Tab, Input, Switch, Tabs } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/ipc'
import React, { Key, useState } from 'react'

const DNS: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { appConfig, patchAppConfig } = useAppConfig()
  const { hosts } = appConfig || {}
  const { dns } = controledMihomoConfig || {}
  const {
    ipv6 = false,
    'fake-ip-range': fakeIPRange = '198.18.0.1/16',
    'fake-ip-range6': fakeIPRange6 = '',
    'fake-ip-filter': fakeIPFilter = [
      '*',
      '+.lan',
      '+.local',
      'time.*.com',
      'ntp.*.com',
      '+.market.xiaomi.com'
    ],
    'enhanced-mode': enhancedMode = 'fake-ip',
    'use-hosts': useHosts = false,
    'use-system-hosts': useSystemHosts = false,
    'respect-rules': respectRules = false,
    'default-nameserver': defaultNameserver = ['tls://223.5.5.5'],
    nameserver = ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
    'proxy-server-nameserver': proxyServerNameserver = [
      'https://doh.pub/dns-query',
      'https://dns.alidns.com/dns-query'
    ],
    'direct-nameserver': directNameserver = [],
    'nameserver-policy': nameserverPolicy = {}
  } = dns || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    ipv6,
    useHosts,
    enhancedMode,
    fakeIPRange,
    fakeIPRange6,
    fakeIPFilter,
    useSystemHosts,
    respectRules,
    defaultNameserver,
    nameserver,
    proxyServerNameserver,
    directNameserver,
    nameserverPolicy,
    hosts: useHosts ? hosts : undefined
  })

  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const onSave = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchAppConfig({
      hosts: values.hosts
    })
    try {
      setChanged(false)
      await patchControledMihomoConfig(patch)
      await restartCore()
    } catch (e) {
      alert(e)
    }
  }

  return (
    <BasePage
      title="DNS 设置"
      header={
        changed && (
          <Button
            size="sm"
            className="app-nodrag"
            color="primary"
            onPress={() => {
              const hostsObject =
                values.useHosts && values.hosts && values.hosts.length > 0
                  ? Object.fromEntries(values.hosts.map(({ domain, value }) => [domain, value]))
                  : undefined
              const dnsConfig = {
                ipv6: values.ipv6,
                'fake-ip-range': values.fakeIPRange,
                'fake-ip-range6': values.fakeIPRange6,
                'fake-ip-filter': values.fakeIPFilter,
                'enhanced-mode': values.enhancedMode,
                'use-hosts': values.useHosts,
                'use-system-hosts': values.useSystemHosts,
                'respect-rules': values.respectRules,
                'default-nameserver': values.defaultNameserver,
                nameserver: values.nameserver,
                'proxy-server-nameserver': values.proxyServerNameserver,
                'direct-nameserver': values.directNameserver,
                'nameserver-policy': values.nameserverPolicy
              }
              onSave({
                dns: dnsConfig,
                hosts: hostsObject
              })
            }}
          >
            保存
          </Button>
        )
      }
    >
      <SettingCard>
        <SettingItem title="IPv6" divider>
          <Switch
            size="sm"
            isSelected={values.ipv6}
            onValueChange={(v) => {
              setValues({ ...values, ipv6: v })
            }}
          />
        </SettingItem>
        <SettingItem title="连接遵守规则" divider>
          <Switch
            size="sm"
            isSelected={values.respectRules}
            isDisabled={values.proxyServerNameserver.length === 0}
            onValueChange={(v) => {
              setValues({
                ...values,
                respectRules: values.proxyServerNameserver.length === 0 ? false : v
              })
            }}
          />
        </SettingItem>
        <SettingItem title="域名映射模式" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={values.enhancedMode}
            onSelectionChange={(key: Key) => setValues({ ...values, enhancedMode: key as DnsMode })}
          >
            <Tab key="fake-ip" title="虚假 IP" />
            <Tab key="redir-host" title="真实 IP" />
            <Tab key="normal" title="取消映射" />
          </Tabs>
        </SettingItem>
        {values.enhancedMode === 'fake-ip' && (
          <>
            <SettingItem title="虚假 IP 范围 (IPv4)" divider>
              <Input
                size="sm"
                className="w-[40%]"
                placeholder="例：198.18.0.1/16"
                value={values.fakeIPRange}
                onValueChange={(v) => {
                  setValues({ ...values, fakeIPRange: v })
                }}
              />
            </SettingItem>
            {values.ipv6 && (
              <SettingItem title="虚假 IP 范围 (IPv6)" divider>
                <Input
                  size="sm"
                  className="w-[40%]"
                  placeholder="例：fc00::/18"
                  value={values.fakeIPRange6}
                  onValueChange={(v) => {
                    setValues({ ...values, fakeIPRange6: v })
                  }}
                />
              </SettingItem>
            )}
            <EditableList
              title="虚假 IP 过滤器"
              items={values.fakeIPFilter}
              onChange={(list) => setValues({ ...values, fakeIPFilter: list as string[] })}
              placeholder="例：+.lan"
            />
          </>
        )}
        <EditableList
          title="基础服务器"
          items={values.defaultNameserver}
          onChange={(list) => setValues({ ...values, defaultNameserver: list as string[] })}
          placeholder="例：223.5.5.5，仅支持 IP"
        />
        <EditableList
          title="默认解析服务器"
          items={values.nameserver}
          onChange={(list) => setValues({ ...values, nameserver: list as string[] })}
          placeholder="例：tls://dns.alidns.com"
        />
        <EditableList
          title="直连解析服务器"
          items={values.directNameserver}
          onChange={(list) => setValues({ ...values, directNameserver: list as string[] })}
          placeholder="例：tls://dns.alidns.com"
        />
        <EditableList
          title="代理节点解析服务器"
          items={values.proxyServerNameserver}
          onChange={(list) =>
            setValues({
              ...values,
              proxyServerNameserver: list as string[],
              respectRules: (list as string[]).length === 0 ? false : values.respectRules
            })
          }
          placeholder="例：tls://dns.alidns.com"
        />
        <EditableList
          title="域名解析策略"
          items={values.nameserverPolicy}
          onChange={(newValue) => {
            setValues({
              ...values,
              nameserverPolicy: newValue as { [key: string]: string | string[] }
            })
          }}
          placeholder="域名"
          part2Placeholder="DNS 服务器，用逗号分隔"
          objectMode="record"
        />
        <SettingItem title="使用系统 Hosts" divider>
          <Switch
            size="sm"
            isSelected={values.useSystemHosts}
            onValueChange={(v) => {
              setValues({ ...values, useSystemHosts: v })
            }}
          />
        </SettingItem>
        <SettingItem title="自定义 Hosts">
          <Switch
            size="sm"
            isSelected={values.useHosts}
            onValueChange={(v) => {
              setValues({ ...values, useHosts: v })
            }}
          />
        </SettingItem>
        {values.useHosts && (
          <EditableList
            items={
              values.hosts ? Object.fromEntries(values.hosts.map((h) => [h.domain, h.value])) : {}
            }
            onChange={(rec) => {
              const hostArr: IHost[] = Object.entries(rec as Record<string, string | string[]>).map(
                ([domain, value]) => ({
                  domain,
                  value: value as string | string[]
                })
              )
              setValues({ ...values, hosts: hostArr })
            }}
            placeholder="域名"
            part2Placeholder="域名或 IP，用逗号分隔多个值"
            objectMode="record"
            divider={false}
          />
        )}
      </SettingCard>
    </BasePage>
  )
}

export default DNS
