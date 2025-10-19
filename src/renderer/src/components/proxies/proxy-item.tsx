import { Button, Card, CardBody } from '@heroui/react'
import { mihomoUnfixedProxy } from '@renderer/utils/ipc'
import React, { useMemo, useState } from 'react'
import { FaMapPin } from 'react-icons/fa6'

interface Props {
  mutateProxies: () => void
  onProxyDelay: (proxy: string, url?: string) => Promise<ControllerProxiesDelay>
  proxyDisplayMode: 'hidden' | 'simple' | 'full'
  proxyDisplayLayout: 'hidden' | 'single' | 'double'
  proxy: ControllerProxiesDetail | ControllerGroupDetail
  group: ControllerMixedGroup
  onSelect: (group: string, proxy: string) => void
  selected: boolean
}

const ProxyItem: React.FC<Props> = (props) => {
  const {
    mutateProxies,
    proxyDisplayMode,
    proxyDisplayLayout,
    group,
    proxy,
    selected,
    onSelect,
    onProxyDelay
  } = props

  const delay = useMemo(() => {
    if (proxy.history.length > 0) {
      return proxy.history[proxy.history.length - 1].delay
    }
    return -1
  }, [proxy])

  const [loading, setLoading] = useState(false)
  function delayColor(delay: number): 'primary' | 'success' | 'warning' | 'danger' {
    if (delay === -1) return 'primary'
    if (delay === 0) return 'danger'
    if (delay < 500) return 'success'
    return 'warning'
  }

  function delayText(delay: number): string {
    if (delay === -1) return '测试'
    if (delay === 0) return '超时'
    return delay.toString()
  }

  const onDelay = (): void => {
    setLoading(true)
    onProxyDelay(proxy.name, group.testUrl).finally(() => {
      mutateProxies()
      setLoading(false)
    })
  }

  const fixed = group.fixed && group.fixed === proxy.name

  return (
    <Card
      as="div"
      onPress={() => onSelect(group.name, proxy.name)}
      isPressable
      fullWidth
      shadow="sm"
      className={`${fixed ? 'bg-secondary/30' : selected ? 'bg-primary/30' : 'bg-content2'}`}
      radius="sm"
    >
      <CardBody className="py-1.5 px-2">
        <div
          className={`flex ${proxyDisplayMode === 'full' && proxyDisplayLayout === 'double' ? 'gap-1' : 'justify-between items-center'}`}
        >
          {proxyDisplayMode === 'full' && proxyDisplayLayout === 'double' ? (
            <>
              <div className="flex flex-col gap-0 flex-1 min-w-0">
                <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                  <div className="flag-emoji inline" title={proxy.name}>
                    {proxy.name}
                  </div>
                </div>
                <div className="text-[12px] text-foreground-500 leading-none mt-0.5">
                  <span>{proxy.type}</span>
                </div>
              </div>
              <div className="flex items-center justify-center gap-0.5 shrink-0">
                {fixed && (
                  <Button
                    isIconOnly
                    title="取消固定"
                    color="danger"
                    onPress={async () => {
                      await mihomoUnfixedProxy(group.name)
                      mutateProxies()
                    }}
                    variant="light"
                    className="h-[24px] w-[24px] min-w-[24px] p-0 text-xs"
                  >
                    <FaMapPin className="text-xs le" />
                  </Button>
                )}
                <Button
                  isIconOnly
                  title={proxy.type}
                  isLoading={loading}
                  color={delayColor(delay)}
                  onPress={onDelay}
                  variant="light"
                  className="h-[32px] w-[32px] min-w-[32px] p-0 text-xs"
                >
                  {delayText(delay)}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-ellipsis overflow-hidden whitespace-nowrap">
                <div className="flag-emoji inline" title={proxy.name}>
                  {proxy.name}
                </div>
                {proxyDisplayMode === 'full' && proxyDisplayLayout === 'single' && (
                  <div className="inline ml-2 text-foreground-500" title={proxy.type}>
                    {proxy.type}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                {fixed && (
                  <div className="flex items-center">
                    <Button
                      isIconOnly
                      title="取消固定"
                      color="danger"
                      onPress={async () => {
                        await mihomoUnfixedProxy(group.name)
                        mutateProxies()
                      }}
                      variant="light"
                      className="h-[24px] w-[24px] min-w-[24px] p-0 text-xs"
                    >
                      <FaMapPin className="text-xs le" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center">
                  <Button
                    isIconOnly
                    title={proxy.type}
                    isLoading={loading}
                    color={delayColor(delay)}
                    onPress={onDelay}
                    variant="light"
                    className="h-full w-[32px] min-w-[32px] p-0 text-sm"
                  >
                    {delayText(delay)}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default ProxyItem
