import { Button, Chip, Separator, Meter } from '@heroui/react'

import {
  mihomoProxyProviders,
  mihomoUpdateProxyProviders,
  getRuntimeConfig
} from '@renderer/utils/ipc'
import { Fragment, useEffect, useMemo, useState } from 'react'
import Viewer from './viewer'
import useSWR from 'swr'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdEditDocument, MdQrCode2 } from 'react-icons/md'
import QRCodeModal from '../base/base-qrcode-modal'
import dayjs from 'dayjs'
import { calcTraffic } from '@renderer/utils/calc'
import { getHash } from '@renderer/utils/hash'

import { notify } from '@renderer/utils/notification'

const ProxyProvider: React.FC = () => {
  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    providerType: '',
    ageSecretKey: ''
  })
  const [qrCode, setQrCode] = useState<{
    name: string
    url: string
  } | null>(null)
  useEffect(() => {
    if (showDetails.title) {
      const fetchProviderPath = async (name: string): Promise<void> => {
        try {
          const providers = await getRuntimeConfig()
          const provider = providers?.['proxy-providers']?.[name] as ProxyProviderConfig
          if (provider) {
            setShowDetails((prev) => ({
              ...prev,
              show: true,
              path: provider.path || `proxies/${getHash(provider.url || '')}`,
              ageSecretKey: provider['age-secret-key'] || ''
            }))
          }
        } catch {
          setShowDetails((prev) => ({ ...prev, path: '', ageSecretKey: '' }))
        }
      }
      fetchProviderPath(showDetails.title)
    }
  }, [showDetails.title])

  const { data, mutate } = useSWR('mihomoProxyProviders', mihomoProxyProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  useEffect(() => {
    const unsubscribeCoreStarted = window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      unsubscribeCoreStarted()
    }
  }, [])

  const providers = useMemo(() => {
    if (!data) return []
    return Object.values(data.providers)
      .filter((provider) => provider.vehicleType !== 'Compatible')
      .sort((a, b) => {
        const order = { File: 1, Inline: 2, HTTP: 3 }
        return (order[a.vehicleType] || 4) - (order[b.vehicleType] || 4)
      })
  }, [data])
  const [updating, setUpdating] = useState(Array(providers.length).fill(false))

  const onUpdate = async (name: string, index: number): Promise<void> => {
    setUpdating((prev) => {
      prev[index] = true
      return [...prev]
    })
    try {
      await mihomoUpdateProxyProviders(name)
      mutate()
    } catch (e) {
      notify(`${name} 更新失败\n${e}`, { variant: 'danger' })
    } finally {
      setUpdating((prev) => {
        prev[index] = false
        return [...prev]
      })
    }
  }

  if (!providers.length) {
    return null
  }

  const onShowQrCode = async (name: string): Promise<void> => {
    try {
      const config = await getRuntimeConfig()
      const provider = config?.['proxy-providers']?.[name] as ProxyProviderConfig
      if (provider?.url) {
        setQrCode({ name, url: provider.url })
      }
    } catch {
      // ignore
    }
  }

  return (
    <SettingCard>
      {qrCode && (
        <QRCodeModal title={qrCode.name} url={qrCode.url} onClose={() => setQrCode(null)} />
      )}
      {showDetails.show && (
        <Viewer
          path={showDetails.path}
          type={showDetails.type}
          title={showDetails.title}
          providerType={showDetails.providerType}
          ageSecretKey={showDetails.ageSecretKey || undefined}
          onClose={() =>
            setShowDetails({
              show: false,
              path: '',
              type: '',
              title: '',
              providerType: '',
              ageSecretKey: ''
            })
          }
        />
      )}
      <SettingItem compatKey="legacy" title="代理集合" divider>
        <Button
          size="sm"
          onPress={() => {
            providers.forEach((provider, index) => {
              onUpdate(provider.name, index)
            })
          }}
          variant="primary"
          data-color="primary"
        >
          更新全部
        </Button>
      </SettingItem>
      {providers.map((provider, index) => (
        <Fragment key={provider.name}>
          <SettingItem
            compatKey="legacy"
            title={provider.name}
            actions={
              <Chip
                size="sm"
                data-color="default"
                variant="primary"
                className={['ml-2'].filter(Boolean).join(' ')}
              >
                <Chip.Label>{provider.proxies?.length || 0}</Chip.Label>
              </Chip>
            }
            divider={!provider.subscriptionInfo && index !== providers.length - 1}
          >
            <div className="flex h-8 leading-8 text-foreground-500">
              <div>{dayjs(provider.updatedAt).fromNow()}</div>
              {provider.vehicleType === 'HTTP' && (
                <Button
                  isIconOnly
                  size="sm"
                  onPress={() => onShowQrCode(provider.name)}
                  variant="primary"
                  data-color="default"
                  className="ml-2"
                >
                  <MdQrCode2 className="text-lg" />
                </Button>
              )}
              <Button
                isIconOnly
                size="sm"
                onPress={() => {
                  setShowDetails({
                    show: false,
                    providerType: 'proxy-providers',
                    path: provider.name,
                    type: provider.vehicleType,
                    title: provider.name,
                    ageSecretKey: ''
                  })
                }}
                variant="primary"
                data-color="default"
                className="ml-2"
              >
                {provider.vehicleType == 'File' ? (
                  <MdEditDocument className={`text-lg`} />
                ) : (
                  <CgLoadbarDoc className={`text-lg`} />
                )}
              </Button>
              <Button
                isIconOnly
                size="sm"
                onPress={() => {
                  onUpdate(provider.name, index)
                }}
                variant="primary"
                data-color="default"
                className="ml-2"
              >
                <IoMdRefresh className={`text-lg ${updating[index] ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </SettingItem>
          {provider.subscriptionInfo && (
            <>
              <SettingItem
                compatKey="legacy"
                title={
                  <div className="text-foreground-500">
                    {`${calcTraffic(provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download)} / ${calcTraffic(provider.subscriptionInfo.Total)}`}
                  </div>
                }
              >
                <div className="h-8 leading-8 text-foreground-500">
                  {provider.subscriptionInfo.Expire
                    ? dayjs.unix(provider.subscriptionInfo.Expire).format('YYYY-MM-DD')
                    : '长期有效'}
                </div>
              </SettingItem>
              <Meter
                aria-label={`${provider.name} 流量使用`}
                className="w-full"
                maxValue={provider.subscriptionInfo.Total}
                value={provider.subscriptionInfo.Upload + provider.subscriptionInfo.Download}
              >
                <Meter.Track>
                  <Meter.Fill />
                </Meter.Track>
              </Meter>
              {index !== providers.length - 1 && <Separator className="my-2" />}
            </>
          )}
        </Fragment>
      ))}
    </SettingCard>
  )
}

export default ProxyProvider
