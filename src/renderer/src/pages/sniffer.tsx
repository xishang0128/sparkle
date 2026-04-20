import { Button, Input, Switch } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore } from '@renderer/utils/ipc'
import React, { useState } from 'react'

const Sniffer: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { sniffer } = controledMihomoConfig || {}
  const {
    'parse-pure-ip': parsePureIP = true,
    'force-dns-mapping': forceDNSMapping = true,
    'override-destination': overrideDestination = false,
    sniff = {
      HTTP: { ports: [80, 443], 'override-destination': false },
      TLS: { ports: [443] },
      QUIC: { ports: [] }
    },
    'skip-domain': skipDomain = ['+.push.apple.com'],
    'force-domain': forceDomain = [],
    'skip-dst-address': skipDstAddress = [
      '91.105.192.0/23',
      '91.108.4.0/22',
      '91.108.8.0/21',
      '91.108.16.0/21',
      '91.108.56.0/22',
      '95.161.64.0/20',
      '149.154.160.0/20',
      '185.76.151.0/24',
      '2001:67c:4e8::/48',
      '2001:b28:f23c::/47',
      '2001:b28:f23f::/48',
      '2a0a:f280:203::/48'
    ],
    'skip-src-address': skipSrcAddress = []
  } = sniffer || {}
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    parsePureIP,
    forceDNSMapping,
    overrideDestination,
    sniff,
    skipDomain,
    forceDomain,
    skipDstAddress,
    skipSrcAddress
  })
  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }

  const onSave = async (patch: Partial<MihomoConfig>): Promise<void> => {
    try {
      setChanged(false)
      await patchControledMihomoConfig(patch)
      await restartCore()
    } catch (e) {
      alert(e)
    }
  }

  const handleSniffPortChange = (protocol: keyof typeof sniff, value: string): void => {
    setValues({
      ...values,
      sniff: {
        ...values.sniff,
        [protocol]: {
          ...values.sniff[protocol],
          ports: value.split(',').map((port) => port.trim())
        }
      }
    })
  }

  return (
    <BasePage
      title="域名嗅探设置"
      contentClassName="no-scrollbar"
      header={
        changed && (
          <Button
            size="sm"
            className="app-nodrag"
            color="primary"
            onPress={() =>
              onSave({
                sniffer: {
                  'parse-pure-ip': values.parsePureIP,
                  'force-dns-mapping': values.forceDNSMapping,
                  'override-destination': values.overrideDestination,
                  sniff: values.sniff,
                  'skip-domain': values.skipDomain,
                  'force-domain': values.forceDomain
                }
              })
            }
          >
            保存
          </Button>
        )
      }
    >
      <SettingCard>
        <SettingItem compatKey="legacy" title="覆盖连接地址" divider>
          <Switch
            size="sm"
            isSelected={values.overrideDestination}
            onValueChange={(v) => {
              setValues({
                ...values,
                overrideDestination: v,
                sniff: {
                  ...values.sniff,
                  HTTP: {
                    ...values.sniff.HTTP,
                    'override-destination': v,
                    ports: values.sniff.HTTP?.ports || [80, 443]
                  }
                }
              })
            }}
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="对真实 IP 映射嗅探" divider>
          <Switch
            size="sm"
            isSelected={values.forceDNSMapping}
            onValueChange={(v) => {
              setValues({ ...values, forceDNSMapping: v })
            }}
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="对未映射 IP 地址嗅探" divider>
          <Switch
            size="sm"
            isSelected={values.parsePureIP}
            onValueChange={(v) => {
              setValues({ ...values, parsePureIP: v })
            }}
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="HTTP 端口嗅探" divider>
          <Input
            size="sm"
            className="w-[50%]"
            placeholder="端口号，使用逗号分割多个值"
            value={values.sniff.HTTP?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('HTTP', v)}
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="TLS 端口嗅探" divider>
          <Input
            size="sm"
            className="w-[50%]"
            placeholder="端口号，使用逗号分割多个值"
            value={values.sniff.TLS?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('TLS', v)}
          />
        </SettingItem>
        <SettingItem compatKey="legacy" title="QUIC 端口嗅探" divider>
          <Input
            size="sm"
            className="w-[50%]"
            placeholder="端口号，使用逗号分割多个值"
            value={values.sniff.QUIC?.ports.join(',')}
            onValueChange={(v) => handleSniffPortChange('QUIC', v)}
          />
        </SettingItem>
        <EditableList
          title="跳过域名嗅探"
          items={values.skipDomain}
          onChange={(list) => setValues({ ...values, skipDomain: list as string[] })}
          placeholder="例：+.push.apple.com"
        />
        <EditableList
          title="强制域名嗅探"
          items={values.forceDomain}
          onChange={(list) => setValues({ ...values, forceDomain: list as string[] })}
          placeholder="例：v2ex.com"
        />
        <EditableList
          title="跳过目标地址嗅探"
          items={values.skipDstAddress}
          onChange={(list) => setValues({ ...values, skipDstAddress: list as string[] })}
          placeholder="例：1.1.1.1/32"
        />
        <EditableList
          title="跳过来源地址嗅探"
          items={values.skipSrcAddress}
          onChange={(list) => setValues({ ...values, skipSrcAddress: list as string[] })}
          placeholder="例：192.168.1.1/24"
          divider={false}
        />
      </SettingCard>
    </BasePage>
  )
}

export default Sniffer
