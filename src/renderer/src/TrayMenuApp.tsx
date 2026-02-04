import { useEffect, useState, useMemo } from 'react'
import { Button, ScrollShadow, Chip, Accordion, AccordionItem } from '@heroui/react'
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
            variant="light"
            isIconOnly
            onPress={handleRefresh}
            className="min-w-6 w-6 h-6"
          >
            <IoRefresh className="text-base" />
          </Button>
          <Button
            size="sm"
            variant="light"
            isIconOnly
            onPress={handleClose}
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
            selectionMode="multiple"
            defaultExpandedKeys={defaultExpandedKeys}
            className="px-1"
            itemClasses={{
              base: 'py-0',
              title: 'text-sm font-medium',
              trigger: 'py-2 data-[hover=true]:bg-default-100 rounded-lg px-2',
              content: 'pt-0 pb-2'
            }}
          >
            {groups.map((group) => (
              <AccordionItem
                key={group.name}
                aria-label={group.name}
                title={
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-2">
                      <span>{group.name}</span>
                      <Chip size="sm" variant="flat" className="text-[10px] h-4">
                        {group.type}
                      </Chip>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="light"
                        isIconOnly
                        isLoading={testingGroup === group.name}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleTestDelay(group.name, group.testUrl)
                        }}
                        className="min-w-5 w-5 h-5"
                      >
                        <IoRefresh className="text-xs" />
                      </Button>
                      <Chip
                        size="sm"
                        color={getDelayColor(getCurrentDelay(group))}
                        variant="flat"
                        className="text-[10px] h-5 min-w-[52px]"
                      >
                        {formatDelay(getCurrentDelay(group))}
                      </Chip>
                    </div>
                  </div>
                }
              >
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
                            <IoCheckmarkCircle className="text-primary text-sm flex-shrink-0" />
                          )}
                          <span
                            className={`text-xs truncate ${isActive ? 'text-primary font-medium' : ''}`}
                          >
                            {proxy.name}
                          </span>
                        </div>
                        <Chip
                          size="sm"
                          color={getDelayColor(delay)}
                          variant="flat"
                          className="text-[10px] h-4 min-w-[48px] flex-shrink-0"
                        >
                          {formatDelay(delay)}
                        </Chip>
                      </div>
                    )
                  })}
                </div>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </ScrollShadow>
    </div>
  )
}

export default TrayMenuApp
