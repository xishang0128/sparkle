import {
  mihomoRuleProviders,
  mihomoUpdateRuleProviders,
  getRuntimeConfig
} from '@renderer/utils/ipc'
import { getHash } from '@renderer/utils/hash'
import Viewer from './viewer'
import { Fragment, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Chip } from '@heroui/react'
import { IoMdRefresh } from 'react-icons/io'
import { CgLoadbarDoc } from 'react-icons/cg'
import { MdEditDocument } from 'react-icons/md'
import dayjs from 'dayjs'
import { notify } from '@renderer/utils/notification'

const LARGE_RULE_PREVIEW_THRESHOLD = 10000

const RuleProvider: React.FC = () => {
  const [showDetails, setShowDetails] = useState({
    show: false,
    path: '',
    type: '',
    title: '',
    format: '',
    providerType: ''
  })
  useEffect(() => {
    if (!showDetails.title) return

    let canceled = false
    const fetchProviderPath = async (name: string): Promise<void> => {
      try {
        const providers = await getRuntimeConfig()
        const provider = providers?.['rule-providers']?.[name] as ProxyProviderConfig
        if (canceled) return
        if (provider) {
          setShowDetails((prev) => ({
            ...prev,
            show: true,
            path: provider?.path || `rules/${getHash(provider?.url || '')}`
          }))
        } else {
          setShowDetails((prev) => ({ ...prev, show: true, path: name }))
        }
      } catch {
        if (canceled) return
        setShowDetails((prev) => ({ ...prev, show: true, path: name }))
      }
    }
    fetchProviderPath(showDetails.title)
    return () => {
      canceled = true
    }
  }, [showDetails.title])

  const { data, mutate } = useSWR('mihomoRuleProviders', mihomoRuleProviders, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })

  useEffect(() => {
    window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('core-started')
    }
  }, [])

  const providers = useMemo(() => {
    if (!data) return []
    return Object.values(data.providers).sort((a, b) => {
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
      await mihomoUpdateRuleProviders(name)
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

  const openProviderDetails = (provider: ControllerRuleProviderDetail): void => {
    setShowDetails({
      show: true,
      providerType: 'rule-providers',
      path: '',
      type: provider.vehicleType,
      title: provider.name,
      format: provider.format
    })
  }

  const onOpenProviderDetails = (provider: ControllerRuleProviderDetail): void => {
    if (provider.ruleCount <= LARGE_RULE_PREVIEW_THRESHOLD) {
      openProviderDetails(provider)
      return
    }

    notify('规则数量较多，已取消自动打开', {
      actionProps: {
        children: '继续打开',
        onPress: () => openProviderDetails(provider),
        variant: 'secondary'
      },
      body: `${provider.name} 包含 ${provider.ruleCount} 条规则，完整预览可能占用较多内存并导致界面卡顿。`,
      forceToast: true,
      timeout: 12000,
      variant: 'warning'
    })
  }

  if (!providers.length) {
    return null
  }

  return (
    <SettingCard>
      {showDetails.show && (
        <Viewer
          path={showDetails.path}
          type={showDetails.type}
          title={showDetails.title}
          format={showDetails.format}
          providerType={showDetails.providerType}
          onClose={() =>
            setShowDetails({
              show: false,
              path: '',
              type: '',
              title: '',
              format: '',
              providerType: ''
            })
          }
        />
      )}
      <SettingItem compatKey="legacy" title="规则集合" divider>
        <Button
          size="sm"
          color="primary"
          onPress={() => {
            providers.forEach((provider, index) => {
              onUpdate(provider.name, index)
            })
          }}
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
              <Chip className="ml-2" size="sm">
                {provider.ruleCount}
              </Chip>
            }
          >
            <div className="flex h-8 leading-8 text-foreground-500">
              <div>{dayjs(provider.updatedAt).fromNow()}</div>
              {provider.vehicleType !== 'Inline' && (
                <Button
                  isIconOnly
                  className="ml-2"
                  size="sm"
                  onPress={() => onOpenProviderDetails(provider)}
                >
                  {provider.vehicleType == 'File' ? (
                    <MdEditDocument className={`text-lg`} />
                  ) : (
                    <CgLoadbarDoc className={`text-lg`} />
                  )}
                </Button>
              )}
              <Button
                isIconOnly
                className="ml-2"
                size="sm"
                onPress={() => {
                  onUpdate(provider.name, index)
                }}
              >
                <IoMdRefresh className={`text-lg ${updating[index] ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </SettingItem>
          <SettingItem
            compatKey="legacy"
            title={<div className="text-foreground-500">{provider.format || 'InlineRule'}</div>}
            divider={index !== providers.length - 1}
          >
            <div className="h-8 leading-8 text-foreground-500">
              {provider.vehicleType}::{provider.behavior}
            </div>
          </SettingItem>
        </Fragment>
      ))}
    </SettingCard>
  )
}

export default RuleProvider
