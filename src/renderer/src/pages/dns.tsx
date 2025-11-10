import { Button, Tab, Input, Switch, Tabs, Tooltip } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import AdvancedDnsSetting from '@renderer/components/dns/advanced-dns-setting'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/ipc'
import React, { Key, useState } from 'react'
import {
  isValidIPv4Cidr,
  isValidIPv6Cidr,
  isValidDomainWildcard,
  isValidDnsServer
} from '@renderer/utils/validate'

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
    'proxy-server-nameserver': proxyServerNameserver = [],
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
  const [fakeIPRangeError, setFakeIPRangeError] = useState<string | null>(() => {
    const r = isValidIPv4Cidr(fakeIPRange)
    return r.ok ? null : (r.error ?? '格式错误')
  })
  const [fakeIPRange6Error, setFakeIPRange6Error] = useState<string | null>(() => {
    const r = isValidIPv6Cidr(fakeIPRange6)
    return r.ok ? null : (r.error ?? '格式错误')
  })
  const [fakeIPFilterError, setFakeIPFilterError] = useState<string | null>(() => {
    if (!Array.isArray(fakeIPFilter)) return null
    const firstInvalid = fakeIPFilter.find((f) => !isValidDomainWildcard(f).ok)
    return firstInvalid ? (isValidDomainWildcard(firstInvalid).error ?? '格式错误') : null
  })
  const [defaultNameserverError, setDefaultNameserverError] = useState<string | null>(() => {
    if (!Array.isArray(defaultNameserver)) return null
    const firstInvalid = defaultNameserver.find((f) => !isValidDnsServer(f, true).ok)
    return firstInvalid ? (isValidDnsServer(firstInvalid, true).error ?? '格式错误') : null
  })
  const [nameserverError, setNameserverError] = useState<string | null>(() => {
    if (!Array.isArray(nameserver)) return null
    const firstInvalid = nameserver.find((f) => !isValidDnsServer(f).ok)
    return firstInvalid ? (isValidDnsServer(firstInvalid).error ?? '格式错误') : null
  })
  const [advancedDnsError, setAdvancedDnsError] = useState(false)
  const hasDnsErrors = Boolean(defaultNameserverError || nameserverError || advancedDnsError)

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
            isDisabled={
              values && values.enhancedMode === 'fake-ip'
                ? Boolean(fakeIPRangeError) ||
                  (values.ipv6 && Boolean(fakeIPRange6Error)) ||
                  Boolean(fakeIPFilterError) ||
                  hasDnsErrors
                : hasDnsErrors
            }
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
              <Tooltip
                content={fakeIPRangeError}
                placement="right"
                isOpen={!!fakeIPRangeError}
                showArrow={true}
                color="danger"
                offset={15}
              >
                <Input
                  size="sm"
                  className={
                    `w-[40%] ` +
                    (fakeIPRangeError ? 'border-red-500 ring-1 ring-red-500 rounded-lg' : '')
                  }
                  placeholder="例：198.18.0.1/16"
                  value={values.fakeIPRange}
                  onValueChange={(v) => {
                    setValues({ ...values, fakeIPRange: v })
                    const r = isValidIPv4Cidr(v)
                    setFakeIPRangeError(r.ok ? null : (r.error ?? '格式错误'))
                  }}
                />
              </Tooltip>
            </SettingItem>
            {values.ipv6 && (
              <SettingItem title="虚假 IP 范围 (IPv6)" divider>
                <Tooltip
                  content={fakeIPRange6Error}
                  placement="right"
                  isOpen={!!fakeIPRange6Error}
                  showArrow={true}
                  color="danger"
                  offset={10}
                >
                  <Input
                    size="sm"
                    className={
                      `w-[40%] ` +
                      (fakeIPRange6Error ? 'border-red-500 ring-1 ring-red-500 rounded-lg' : '')
                    }
                    placeholder="例：fc00::/18"
                    value={values.fakeIPRange6}
                    onValueChange={(v) => {
                      setValues({ ...values, fakeIPRange6: v })
                      const r = isValidIPv6Cidr(v)
                      setFakeIPRange6Error(r.ok ? null : (r.error ?? '格式错误'))
                    }}
                  />
                </Tooltip>
              </SettingItem>
            )}
            <EditableList
              title="虚假 IP 过滤器"
              items={values.fakeIPFilter}
              validate={(part) => isValidDomainWildcard(part as string)}
              onChange={(list) => {
                const arr = list as string[]
                setValues({ ...values, fakeIPFilter: arr })
                const firstInvalid = arr.find((f) => !isValidDomainWildcard(f).ok)
                setFakeIPFilterError(
                  firstInvalid ? (isValidDomainWildcard(firstInvalid).error ?? '格式错误') : null
                )
              }}
              placeholder="例：+.lan"
            />
          </>
        )}
        <EditableList
          title="基础服务器"
          items={values.defaultNameserver}
          validate={(part) => isValidDnsServer(part as string, true)}
          onChange={(list) => {
            const arr = list as string[]
            setValues({ ...values, defaultNameserver: arr })
            const firstInvalid = arr.find((f) => !isValidDnsServer(f, true).ok)
            setDefaultNameserverError(
              firstInvalid ? (isValidDnsServer(firstInvalid, true).error ?? '格式错误') : null
            )
          }}
          placeholder="例：223.5.5.5"
        />
        <EditableList
          title="默认解析服务器"
          items={values.nameserver}
          validate={(part) => isValidDnsServer(part as string)}
          onChange={(list) => {
            const arr = list as string[]
            setValues({ ...values, nameserver: arr })
            const firstInvalid = arr.find((f) => !isValidDnsServer(f).ok)
            setNameserverError(
              firstInvalid ? (isValidDnsServer(firstInvalid).error ?? '格式错误') : null
            )
          }}
          placeholder="例：tls://dns.alidns.com"
          divider={false}
        />
      </SettingCard>
      <AdvancedDnsSetting
        respectRules={values.respectRules}
        directNameserver={values.directNameserver}
        proxyServerNameserver={values.proxyServerNameserver}
        nameserverPolicy={values.nameserverPolicy}
        hosts={values.hosts}
        useHosts={values.useHosts}
        useSystemHosts={values.useSystemHosts}
        onRespectRulesChange={(v) => {
          setValues({
            ...values,
            respectRules: values.proxyServerNameserver.length === 0 ? false : v
          })
        }}
        onDirectNameserverChange={(arr) => {
          setValues({ ...values, directNameserver: arr })
        }}
        onProxyNameserverChange={(arr) => {
          setValues({
            ...values,
            proxyServerNameserver: arr,
            respectRules: arr.length === 0 ? false : values.respectRules
          })
        }}
        onNameserverPolicyChange={(newValue) => {
          setValues({ ...values, nameserverPolicy: newValue })
        }}
        onUseSystemHostsChange={(v) => setValues({ ...values, useSystemHosts: v })}
        onUseHostsChange={(v) => setValues({ ...values, useHosts: v })}
        onHostsChange={(hostArr) => setValues({ ...values, hosts: hostArr })}
        onErrorChange={setAdvancedDnsError}
      />
    </BasePage>
  )
}

export default DNS
