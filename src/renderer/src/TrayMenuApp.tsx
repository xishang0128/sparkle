import { Button, Chip, Spinner, ScrollShadow, Accordion } from '@heroui/react'

import { useEffect, useState, useMemo } from 'react'
import { IoRefresh, IoClose, IoCheckmarkCircle } from 'react-icons/io5'
import { useGroups } from './hooks/use-groups'
import { mihomoChangeProxy, mihomoGroupDelay, mihomoCloseConnections } from './utils/ipc'
import { useAppConfig } from './hooks/use-app-config'
import { calcTraffic } from './utils/calc'

interface TrafficData {
  up: number
  down: number
}

const TrayMenuApp: React.FC = () => {
  const { groups, mutate } = useGroups()
  const { appConfig } = useAppConfig()
  const { autoCloseConnection } = appConfig || {}

  const [traffic, setTraffic] = useState<TrafficData>({ up: 0, down: 0 })
  const [testingGroup, setTestingGroup] = useState<string | null>(null)

  useEffect(() => {
    window.electron.ipcRenderer.on('mihomoTraffic', (_e, info: TrafficData) => {
      setTraffic(info)
    })
    return () => {
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
    }
  }, [])

  const handleClose = (): void => {
    window.electron.ipcRenderer.send('customTray:close')
  }

  const handleRefresh = (): void => {
    mutate()
  }

  const handleTestDelay = async (groupName: string, testUrl?: string): Promise<void> => {
    setTestingGroup(groupName)
    try {
      await mihomoGroupDelay(groupName, testUrl)
      mutate()
    } catch (e) {
      // ignore
    } finally {
      setTestingGroup(null)
    }
  }

  const handleSelectProxy = async (groupName: string, proxyName: string): Promise<void> => {
    try {
      await mihomoChangeProxy(groupName, proxyName)
      if (autoCloseConnection) {
        await mihomoCloseConnections()
      }
      mutate()
    } catch (e) {
      // ignore
    }
  }

  const getDelayColor = (
    delay: number | undefined
  ): 'success' | 'warning' | 'danger' | 'default' => {
    if (delay === undefined || delay < 0) return 'default'
    if (delay === 0) return 'danger'
    if (delay <= 150) return 'success'
    if (delay <= 300) return 'warning'
    return 'danger'
  }

  const formatDelay = (delay: number | undefined): string => {
    if (delay === undefined || delay < 0) return '--'
    if (delay === 0) return 'Timeout'
    return `${delay} ms`
  }

  const getCurrentDelay = (group: ControllerMixedGroup): number | undefined => {
    const current = group.all?.find((p) => p.name === group.now)
    if (!current?.history?.length) return undefined
    return current.history[current.history.length - 1].delay
  }

  const getProxyDelay = (
    proxy: ControllerProxiesDetail | ControllerGroupDetail
  ): number | undefined => {
    if (!proxy.history?.length) return undefined
    return proxy.history[proxy.history.length - 1].delay
  }

  const defaultExpandedKeys = useMemo(() => {
    if (!groups) return []
    return groups.slice(0, 3).map((g) => g.name)
  }, [groups])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-content1 rounded-xl border border-divider">
      <div className="flex items-center justify-between px-3 py-2 border-b border-divider bg-content2/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-lg shadow-primary/50" />
          <span className="text-sm font-semibold">Sparkle</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            isIconOnly
            onPress={handleRefresh}
            variant="ghost"
            data-color="default"
            className="min-w-6 w-6 h-6"
          >
            <IoRefresh className="text-base" />
          </Button>
          <Button
            size="sm"
            isIconOnly
            onPress={handleClose}
            variant="ghost"
            data-color="default"
            className="min-w-6 w-6 h-6"
          >
            <IoClose className="text-base" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 px-3 py-2 border-b border-divider bg-content2/30">
        <div className="flex items-center gap-1">
          <span className="text-xs text-default-500">↑</span>
          <span className="text-xs font-mono font-medium">{calcTraffic(traffic.up)}/s</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-default-500">↓</span>
          <span className="text-xs font-mono font-medium">{calcTraffic(traffic.down)}/s</span>
        </div>
      </div>

      <ScrollShadow className="flex-1 overflow-y-auto">
        {!groups || groups.length === 0 ? (
          <div className="flex items-center justify-center h-full text-default-400 text-sm">
            暂无数据
          </div>
        ) : (
          <Accordion
            defaultExpandedKeys={defaultExpandedKeys}
            allowsMultipleExpanded={true}
            className={['app-accordion app-accordion--tray', 'px-1'].filter(Boolean).join(' ')}
            hideSeparator
          >
            {groups.map((group) => (
              <Accordion.Item
                key={group.name}
                aria-label={group.name}
                id={group.name}
                className="app-accordion__item"
              >
                {() => (
                  <>
                    <Accordion.Heading>
                      <Accordion.Trigger>
                        <span className="flex-1 text-left">
                          {
                            <div className="flex items-center justify-between w-full pr-2">
                              <div className="flex items-center gap-2">
                                <span>{group.name}</span>
                                <Chip
                                  size="sm"
                                  data-color="default"
                                  variant="soft"
                                  className={['text-[10px] h-4'].filter(Boolean).join(' ')}
                                >
                                  <Chip.Label>{group.type}</Chip.Label>
                                </Chip>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  isIconOnly
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleTestDelay(group.name, group.testUrl)
                                  }}
                                  variant="ghost"
                                  data-color="default"
                                  className="min-w-5 w-5 h-5"
                                  isPending={testingGroup === group.name}
                                  isDisabled={testingGroup === group.name}
                                >
                                  {testingGroup === group.name ? (
                                    <Spinner size="sm" color="current" />
                                  ) : null}
                                  <IoRefresh className="text-xs" />
                                </Button>
                                <Chip
                                  size="sm"
                                  data-color={getDelayColor(getCurrentDelay(group))}
                                  variant="soft"
                                  className={['text-[10px] h-5 min-w-13'].filter(Boolean).join(' ')}
                                >
                                  <Chip.Label>{formatDelay(getCurrentDelay(group))}</Chip.Label>
                                </Chip>
                              </div>
                            </div>
                          }
                        </span>
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Heading>
                    <Accordion.Panel>
                      <Accordion.Body>
                        <div className="flex flex-col gap-1 pl-2">
                          {group.all?.map((proxy) => {
                            const isActive = proxy.name === group.now
                            const delay = getProxyDelay(proxy)
                            return (
                              <div
                                key={proxy.name}
                                onClick={() => handleSelectProxy(group.name, proxy.name)}
                                className={`
                          flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer
                          transition-colors duration-150
                          ${isActive ? 'bg-primary/15 border border-primary/30' : 'hover:bg-default-100'}
                        `}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isActive && (
                                    <IoCheckmarkCircle className="text-primary text-sm shrink-0" />
                                  )}
                                  <span
                                    className={`text-xs truncate ${isActive ? 'text-primary font-medium' : ''}`}
                                  >
                                    {proxy.name}
                                  </span>
                                </div>
                                <Chip
                                  size="sm"
                                  data-color={getDelayColor(delay)}
                                  variant="soft"
                                  className={['text-[10px] h-4 min-w-12 shrink-0']
                                    .filter(Boolean)
                                    .join(' ')}
                                >
                                  <Chip.Label>{formatDelay(delay)}</Chip.Label>
                                </Chip>
                              </div>
                            )
                          })}
                        </div>
                      </Accordion.Body>
                    </Accordion.Panel>
                  </>
                )}
              </Accordion.Item>
            ))}
          </Accordion>
        )}
      </ScrollShadow>
    </div>
  )
}

export default TrayMenuApp
