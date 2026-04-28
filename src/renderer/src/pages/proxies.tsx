import { Button, Card, CardBody, Chip } from '@heroui/react'
import { Avatar } from '@heroui-v3/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  getImageDataURL,
  mihomoChangeProxy,
  mihomoCloseConnections,
  mihomoGroupDelay,
  mihomoProxyDelay
} from '@renderer/utils/ipc'
import { FaLocationCrosshairs } from 'react-icons/fa6'
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import { IoIosArrowBack } from 'react-icons/io'
import { MdDoubleArrow, MdOutlineSpeed, MdTune } from 'react-icons/md'
import { useGroups } from '@renderer/hooks/use-groups'
import CollapseInput from '@renderer/components/base/collapse-input'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { runDelayTestsWithConcurrency } from '@renderer/utils/delay-test'

type ProxyLike = ControllerProxiesDetail | ControllerGroupDetail

const EMPTY_PROXIES: ProxyLike[] = []

function getProxyDelay(proxy: ProxyLike): number {
  return proxy.history.length > 0 ? proxy.history[proxy.history.length - 1].delay : -1
}

function compareProxyDelay(a: ProxyLike, b: ProxyLike): number {
  const delayA = getProxyDelay(a)
  const delayB = getProxyDelay(b)
  if (delayA === -1) return -1
  if (delayB === -1) return 1
  if (delayA === 0) return 1
  if (delayB === 0) return -1
  return delayA - delayB
}

const Proxies: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups = [], mutate } = useGroups()
  const { appConfig } = useAppConfig()
  const {
    proxyDisplayLayout = 'double',
    groupDisplayLayout = 'double',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    closeMode = 'all',
    proxyCols = 'auto',
    delayTestUrlScope = 'group',
    delayTestUseGroupApi = false,
    delayTestConcurrency
  } = appConfig || {}
  const [cols, setCols] = useState(1)
  const [isOpen, setIsOpen] = useState(Array(groups.length).fill(false))
  const [delaying, setDelaying] = useState(Array(groups.length).fill(false))
  const [searchValue, setSearchValue] = useState(Array(groups.length).fill(''))
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)

  useEffect(() => {
    setIsOpen((prev) =>
      prev.length === groups.length ? prev : groups.map((_, index) => prev[index] || false)
    )
    setDelaying((prev) =>
      prev.length === groups.length ? prev : groups.map((_, index) => prev[index] || false)
    )
    setSearchValue((prev) =>
      prev.length === groups.length ? prev : groups.map((_, index) => prev[index] || '')
    )
  }, [groups])

  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts: number[] = []
    const allProxies: ProxyLike[][] = []
    groups.forEach((group, index) => {
      if (isOpen[index]) {
        const searchText = searchValue[index] || ''
        let groupProxies = searchText
          ? group.all.filter((proxy) => proxy && includesIgnoreCase(proxy.name, searchText))
          : (group.all as ProxyLike[])

        if (proxyDisplayOrder === 'delay') {
          groupProxies = [...groupProxies].sort(compareProxyDelay)
        }
        if (proxyDisplayOrder === 'name') {
          groupProxies = [...groupProxies].sort((a, b) => a.name.localeCompare(b.name))
        }

        groupCounts.push(Math.ceil(groupProxies.length / cols))
        allProxies.push(groupProxies)
      } else {
        groupCounts.push(0)
        allProxies.push(EMPTY_PROXIES)
      }
    })
    return { groupCounts, allProxies }
  }, [groups, isOpen, proxyDisplayOrder, cols, searchValue])

  const onChangeProxy = useCallback(
    async (group: string, proxy: string): Promise<void> => {
      await mihomoChangeProxy(group, proxy)
      if (autoCloseConnection) {
        if (closeMode === 'all') {
          await mihomoCloseConnections()
        } else if (closeMode === 'group') {
          await mihomoCloseConnections(group)
        }
      }
      mutate()
    },
    [autoCloseConnection, closeMode, mutate]
  )

  const getDelayTestUrl = useCallback(
    (group?: ControllerMixedGroup): string | undefined => {
      if (delayTestUrlScope === 'global') return undefined
      return group?.testUrl
    },
    [delayTestUrlScope]
  )

  const onProxyDelay = useCallback(
    async (proxy: string, group?: ControllerMixedGroup): Promise<ControllerProxiesDelay> => {
      return await mihomoProxyDelay(proxy, getDelayTestUrl(group))
    },
    [getDelayTestUrl]
  )

  const setGroupDelaying = useCallback((index: number, value: boolean): void => {
    setDelaying((prev) => {
      const newDelaying = [...prev]
      newDelaying[index] = value
      return newDelaying
    })
  }, [])

  const onGroupDelay = useCallback(
    async (index: number): Promise<void> => {
      const group = groups[index]
      if (!group) return

      const openedProxies = allProxies[index] || EMPTY_PROXIES
      const proxies = openedProxies.length > 0 ? openedProxies : group.all
      if (proxies.length === 0) return

      if (openedProxies.length === 0) {
        setIsOpen((prev) => {
          const newOpen = [...prev]
          newOpen[index] = true
          return newOpen
        })
      }

      const testUrl = getDelayTestUrl(group)
      setGroupDelaying(index, true)

      try {
        if (delayTestUseGroupApi) {
          await mihomoGroupDelay(group.name, testUrl)
          return
        }

        await runDelayTestsWithConcurrency(proxies, delayTestConcurrency, async (proxy) => {
          try {
            await mihomoProxyDelay(proxy.name, testUrl)
          } catch {
            // ignore
          }
        })
      } catch {
        // ignore
      } finally {
        mutate()
        setGroupDelaying(index, false)
      }
    },
    [
      allProxies,
      groups,
      delayTestUseGroupApi,
      delayTestConcurrency,
      mutate,
      getDelayTestUrl,
      setGroupDelaying
    ]
  )

  const calcCols = useCallback((): number => {
    if (window.matchMedia('(min-width: 1536px)').matches) {
      return 5
    } else if (window.matchMedia('(min-width: 1280px)').matches) {
      return 4
    } else if (window.matchMedia('(min-width: 1024px)').matches) {
      return 3
    } else {
      return 2
    }
  }, [])

  const toggleOpen = useCallback((index: number) => {
    setIsOpen((prev) => {
      const newOpen = [...prev]
      newOpen[index] = !prev[index]
      return newOpen
    })
  }, [])

  const updateSearchValue = useCallback((index: number, value: string) => {
    setSearchValue((prev) => {
      const newSearchValue = [...prev]
      newSearchValue[index] = value
      return newSearchValue
    })
  }, [])

  const scrollToCurrentProxy = useCallback(
    (index: number) => {
      if (!isOpen[index]) {
        setIsOpen((prev) => {
          const newOpen = [...prev]
          newOpen[index] = true
          return newOpen
        })
      }
      let i = 0
      for (let j = 0; j < index; j++) {
        i += groupCounts[j]
      }
      const proxies = allProxies[index].length > 0 ? allProxies[index] : groups[index].all
      i += Math.floor(proxies.findIndex((proxy) => proxy.name === groups[index].now) / cols)
      virtuosoRef.current?.scrollToIndex({
        index: Math.floor(i),
        align: 'start'
      })
    },
    [isOpen, groupCounts, allProxies, groups, cols]
  )

  useEffect(() => {
    if (proxyCols !== 'auto') {
      setCols(parseInt(proxyCols))
      return
    }
    setCols(calcCols())
    const handleResize = (): void => {
      setCols(calcCols())
    }
    window.addEventListener('resize', handleResize)
    return (): void => {
      window.removeEventListener('resize', handleResize)
    }
  }, [proxyCols, calcCols])

  const groupContent = useCallback(
    (index: number) => {
      if (
        groups[index] &&
        groups[index].icon &&
        groups[index].icon.startsWith('http') &&
        !localStorage.getItem(groups[index].icon)
      ) {
        getImageDataURL(groups[index].icon).then((dataURL) => {
          localStorage.setItem(groups[index].icon, dataURL)
          mutate()
        })
      }
      return groups[index] ? (
        <div
          className={`w-full pt-2 ${index === groupCounts.length - 1 && !isOpen[index] ? 'pb-2' : ''} px-2`}
        >
          <Card as="div" isPressable fullWidth onPress={() => toggleOpen(index)}>
            <CardBody className="w-full h-14">
              <div className="flex justify-between h-full">
                <div className="flex text-ellipsis overflow-hidden whitespace-nowrap h-full">
                  {groups[index].icon ? (
                    <Avatar
                      className="mr-2 h-8 w-8 shrink-0 bg-transparent overflow-visible! rounded-none!"
                      size="sm"
                    >
                      <Avatar.Image
                        className="object-contain"
                        src={
                          groups[index].icon.startsWith('<svg')
                            ? `data:image/svg+xml;utf8,${groups[index].icon}`
                            : localStorage.getItem(groups[index].icon) || groups[index].icon
                        }
                      />
                    </Avatar>
                  ) : null}
                  <div
                    className={`flex flex-col h-full ${groupDisplayLayout === 'double' ? '' : 'justify-center'}`}
                  >
                    <div
                      className={`text-ellipsis overflow-hidden whitespace-nowrap leading-tight ${groupDisplayLayout === 'double' ? 'text-md flex-5 flex items-center' : 'text-lg'}`}
                    >
                      <span className="flag-emoji inline-block">{groups[index].name}</span>
                      {groupDisplayLayout === 'single' && (
                        <>
                          <div
                            title={groups[index].type}
                            className="inline ml-2 text-sm text-foreground-500"
                          >
                            {groups[index].type}
                          </div>
                          <div className="inline flag-emoji ml-2 text-sm text-foreground-500">
                            {groups[index].now}
                          </div>
                        </>
                      )}
                    </div>
                    {groupDisplayLayout === 'double' && (
                      <div className="text-ellipsis whitespace-nowrap text-[10px] text-foreground-500 leading-tight flex-3 flex items-center">
                        <span>{groups[index].type}</span>
                        <span className="flag-emoji ml-1 inline-block">{groups[index].now}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <Chip size="sm" className="my-1 mr-2">
                      {groups[index].all.length}
                    </Chip>
                    <CollapseInput
                      title="搜索节点"
                      value={searchValue[index]}
                      onValueChange={(v) => updateSearchValue(index, v)}
                    />
                    <Button
                      title="定位到当前节点"
                      variant="light"
                      size="sm"
                      isIconOnly
                      onPress={() => scrollToCurrentProxy(index)}
                    >
                      <FaLocationCrosshairs className="text-lg text-foreground-500" />
                    </Button>
                    <Button
                      title="延迟测试"
                      variant="light"
                      isLoading={delaying[index]}
                      size="sm"
                      isIconOnly
                      onPress={() => onGroupDelay(index)}
                    >
                      <MdOutlineSpeed className="text-lg text-foreground-500" />
                    </Button>
                  </div>
                  <IoIosArrowBack
                    className={`transition duration-200 ml-2 h-8 text-lg text-foreground-500 flex items-center ${isOpen[index] ? '-rotate-90' : ''}`}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div>Never See This</div>
      )
    },
    [
      groups,
      groupCounts,
      isOpen,
      groupDisplayLayout,
      searchValue,
      delaying,
      toggleOpen,
      updateSearchValue,
      scrollToCurrentProxy,
      onGroupDelay,
      mutate
    ]
  )

  const itemContent = useCallback(
    (index: number, groupIndex: number) => {
      let innerIndex = index
      for (let i = 0; i < groupIndex; i++) {
        innerIndex -= groupCounts[i]
      }

      const proxies = allProxies[groupIndex]
      const items: ReactNode[] = []
      for (let i = 0; i < cols; i++) {
        const proxy = proxies[innerIndex * cols + i]
        if (!proxy) continue

        items.push(
          <ProxyItem
            key={proxy.name}
            mutateProxies={mutate}
            onProxyDelay={onProxyDelay}
            onSelect={onChangeProxy}
            proxy={proxy}
            group={groups[groupIndex]}
            proxyDisplayLayout={proxyDisplayLayout}
            selected={proxy.name === groups[groupIndex].now}
          />
        )
      }

      return proxies ? (
        <div
          style={
            proxyCols !== 'auto'
              ? { gridTemplateColumns: `repeat(${proxyCols}, minmax(0, 1fr))` }
              : {}
          }
          className={`grid ${proxyCols === 'auto' ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : ''} ${groupIndex === groupCounts.length - 1 && innerIndex === groupCounts[groupIndex] - 1 ? 'pb-2' : ''} gap-2 pt-2 mx-2`}
        >
          {items}
        </div>
      ) : (
        <div>Never See This</div>
      )
    },
    [
      groupCounts,
      allProxies,
      proxyCols,
      cols,
      mutate,
      onProxyDelay,
      onChangeProxy,
      groups,
      proxyDisplayLayout
    ]
  )

  return (
    <BasePage
      title="代理组"
      header={
        <Button
          size="sm"
          isIconOnly
          variant="light"
          className="app-nodrag"
          title="代理组设置"
          onPress={() => setIsSettingModalOpen(true)}
        >
          <MdTune className="text-lg" />
        </Button>
      }
    >
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {mode === 'direct' ? (
        <div className="h-full w-full flex justify-center items-center">
          <div className="flex flex-col items-center">
            <MdDoubleArrow className="text-foreground-500 text-[100px]" />
            <h2 className="text-foreground-500 text-[20px]">直连模式</h2>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <GroupedVirtuoso
            ref={virtuosoRef}
            groupCounts={groupCounts}
            groupContent={groupContent}
            itemContent={itemContent}
          />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
