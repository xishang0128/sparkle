import { Button, Input, Switch, Tabs } from '@heroui/react'

import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { mihomoUpgradeGeo } from '@renderer/utils/ipc'
import { useState, useEffect, useMemo } from 'react'
import { IoMdRefresh } from 'react-icons/io'
import { notify } from '@renderer/utils/notification'

const defaultGeoxUrl = {
  geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat',
  geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
  mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb',
  asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb'
}

const GeoData: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    'geox-url': geoxUrlRaw,
    'geodata-mode': geoMode = false,
    'geo-auto-update': geoAutoUpdate = false,
    'geo-update-interval': geoUpdateInterval = 24
  } = controledMihomoConfig || {}

  const geoxUrl = useMemo(() => ({ ...defaultGeoxUrl, ...geoxUrlRaw }), [geoxUrlRaw])

  const [geoipInput, setGeoIpInput] = useState(geoxUrl.geoip)
  const [geositeInput, setGeositeInput] = useState(geoxUrl.geosite)
  const [mmdbInput, setMmdbInput] = useState(geoxUrl.mmdb)
  const [asnInput, setAsnInput] = useState(geoxUrl.asn)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    setGeoIpInput(geoxUrl.geoip)
    setGeositeInput(geoxUrl.geosite)
    setMmdbInput(geoxUrl.mmdb)
    setAsnInput(geoxUrl.asn)
  }, [geoxUrl])

  return (
    <SettingCard>
      <SettingItem compatKey="legacy" title="GeoIP-DAT 数据库" divider>
        <div className="flex w-[70%]">
          {geoipInput !== geoxUrl.geoip && (
            <Button
              size="sm"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, geoip: geoipInput } })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <Input
            value={geoipInput}
            onChange={(event) => setGeoIpInput(event.target.value)}
            fullWidth
          />
        </div>
      </SettingItem>
      <SettingItem compatKey="legacy" title="GeoIP-MMDB 数据库" divider>
        <div className="flex w-[70%]">
          {mmdbInput !== geoxUrl.mmdb && (
            <Button
              size="sm"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, mmdb: mmdbInput } })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <Input
            value={mmdbInput}
            onChange={(event) => setMmdbInput(event.target.value)}
            fullWidth
          />
        </div>
      </SettingItem>
      <SettingItem compatKey="legacy" title="GeoSite 数据库" divider>
        <div className="flex w-[70%]">
          {geositeInput !== geoxUrl.geosite && (
            <Button
              size="sm"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, geosite: geositeInput } })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <Input
            value={geositeInput}
            onChange={(event) => setGeositeInput(event.target.value)}
            fullWidth
          />
        </div>
      </SettingItem>

      <SettingItem compatKey="legacy" title="IP-ASN 数据库" divider>
        <div className="flex w-[70%]">
          {asnInput !== geoxUrl.asn && (
            <Button
              size="sm"
              onPress={() => {
                patchControledMihomoConfig({ 'geox-url': { ...geoxUrl, asn: asnInput } })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <Input value={asnInput} onChange={(event) => setAsnInput(event.target.value)} fullWidth />
        </div>
      </SettingItem>
      <SettingItem compatKey="legacy" title="GeoIP 模式" divider>
        <Tabs
          selectedKey={geoMode ? 'dat' : 'db'}
          onSelectionChange={(key) => {
            patchControledMihomoConfig({ 'geodata-mode': key === 'dat' })
          }}
          data-color="primary"
          data-size="sm"
          data-full-width={false}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="选项">
              <Tabs.Tab key="db" id="db">
                db
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab key="dat" id="dat">
                dat
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      </SettingItem>
      <SettingItem
        compatKey="legacy"
        title="自动更新数据库"
        actions={
          <Button
            size="sm"
            isIconOnly
            onPress={async () => {
              setUpdating(true)
              try {
                await mihomoUpgradeGeo()
                notify('数据库更新成功', { variant: 'success' })
              } catch (e) {
                notify(e, { variant: 'danger' })
              } finally {
                setUpdating(false)
              }
            }}
            variant="ghost"
            data-color="default"
          >
            <IoMdRefresh className={`text-lg ${updating ? 'animate-spin' : ''}`} />
          </Button>
        }
        divider={geoAutoUpdate}
      >
        <Switch
          size="sm"
          isSelected={geoAutoUpdate}
          onChange={(v) => {
            patchControledMihomoConfig({ 'geo-auto-update': v })
          }}
          aria-label="自动更新数据库"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      {geoAutoUpdate && (
        <SettingItem compatKey="legacy" title="更新间隔(小时)">
          <Input
            type="number"
            value={geoUpdateInterval.toString()}
            onChange={(event) => {
              const v = event.target.value
              patchControledMihomoConfig({ 'geo-update-interval': parseInt(v) })
            }}
            className="w-25"
            fullWidth
          />
        </SettingItem>
      )}
    </SettingCard>
  )
}

export default GeoData
