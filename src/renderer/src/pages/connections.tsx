import BasePage from '@renderer/components/base/base-page'
import { mihomoCloseConnections, mihomoCloseConnection } from '@renderer/utils/ipc'
import React, { Key, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import {
  Badge,
  Button,
  Divider,
  Input,
  Select,
  SelectItem,
  Tab,
  Tabs,
  Tooltip
} from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import ConnectionItem from '@renderer/components/connections/connection-item'
import { Virtuoso } from 'react-virtuoso'
import ConnectionDetailModal from '@renderer/components/connections/connection-detail-modal'
import ConnectionSettingModal from '@renderer/components/connections/connection-setting-modal'
import { CgClose, CgTrash } from 'react-icons/cg'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { getIconDataURL, getAppName } from '@renderer/utils/ipc'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'
import { cropAndPadTransparent } from '@renderer/utils/image'
import { platform } from '@renderer/utils/init'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { MdTune } from 'react-icons/md'
import { IoPause, IoPlay } from 'react-icons/io5'
import { compileAdvancedFilter } from '@renderer/utils/advanced-filter'
import {
  ConnectionFilterCompletionSession,
  buildConnectionFilterSuggestionResult,
  getEnhancedConnectionFilterSuggestions,
  isConnectionFilterCompletionSessionActive
} from '@renderer/utils/connection-filter-autocomplete'

let cachedConnections: ControllerConnectionDetail[] = []

const Connections: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'find-process-mode': findProcessMode = 'always' } = controledMihomoConfig || {}
  const [filter, setFilter] = useState('')
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    connectionDirection = 'asc',
    connectionOrderBy = 'time',
    connectionInterval = 500,
    displayIcon = true,
    displayAppName = true
  } = appConfig || {}
  const [connectionsInfo, setConnectionsInfo] = useState<ControllerConnections>()
  const [allConnections, setAllConnections] =
    useState<ControllerConnectionDetail[]>(cachedConnections)
  const [activeConnections, setActiveConnections] = useState<ControllerConnectionDetail[]>([])
  const [closedConnections, setClosedConnections] = useState<ControllerConnectionDetail[]>([])
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const [selected, setSelected] = useState<ControllerConnectionDetail>()

  const [iconMap, setIconMap] = useState<Record<string, string>>({})
  const [appNameCache, setAppNameCache] = useState<Record<string, string>>({})
  const [firstItemRefreshTrigger, setFirstItemRefreshTrigger] = useState(0)

  const [tab, setTab] = useState('active')
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(paused)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const iconRequestQueue = useRef(new Set<string>())
  const processingIcons = useRef(new Set<string>())
  const processIconTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const appNameRequestQueue = useRef(new Set<string>())
  const processingAppNames = useRef(new Set<string>())
  const processAppNameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filterInputRef = useRef<HTMLInputElement>(null)
  const suppressSelectRef = useRef(false)
  const allConnectionsRef = useRef(allConnections)
  const activeConnectionsRef = useRef(activeConnections)
  const deletedIdsRef = useRef(deletedIds)
  const filteredConnectionsRef = useRef<ControllerConnectionDetail[]>([])
  const iconMapRef = useRef<Record<string, string>>({})
  const appNameCacheRef = useRef<Record<string, string>>({})

  const lastActiveTime = useRef<Map<string, number>>(new Map())
  const [isFilterFocused, setIsFilterFocused] = useState(false)
  const [filterCursor, setFilterCursor] = useState(0)
  const [filterScrollLeft, setFilterScrollLeft] = useState(0)
  const [completionSession, setCompletionSession] =
    useState<ConnectionFilterCompletionSession | null>(null)

  const compiledFilter = useMemo(
    () =>
      compileAdvancedFilter(filter, (connection: ControllerConnectionDetail, query: string) => {
        const searchableFields = [
          connection.metadata.process,
          connection.metadata.host,
          connection.metadata.destinationIP,
          connection.metadata.sourceIP,
          connection.chains?.[0],
          connection.rule,
          connection.rulePayload
        ]
          .filter(Boolean)
          .join(' ')

        return includesIgnoreCase(searchableFields, query)
      }),
    [filter]
  )
  const filterSuggestions = useMemo(
    () => getEnhancedConnectionFilterSuggestions(filter, filterCursor),
    [filter, filterCursor]
  )
  const inlineCompletionSuffix = useMemo(() => {
    if (!isFilterFocused || filterCursor !== filter.length || filter === '') {
      return ''
    }

    const suggestion = filterSuggestions[0]
    if (!suggestion) return ''

    const { nextValue } = buildConnectionFilterSuggestionResult(filter, suggestion)
    if (!nextValue.startsWith(filter)) return ''

    return nextValue.slice(filter.length)
  }, [filter, filterCursor, filterSuggestions, isFilterFocused])
  const filteredConnections = useMemo(() => {
    const connections = tab === 'active' ? activeConnections : closedConnections

    let filtered = connections
    if (filter !== '') {
      filtered = connections.filter((connection) => compiledFilter.matches(connection))
    }

    if (connectionOrderBy) {
      const dir = connectionDirection === 'asc' ? 1 : -1
      let comparator: (a: ControllerConnectionDetail, b: ControllerConnectionDetail) => number
      switch (connectionOrderBy) {
        case 'time':
          comparator = (a, b) => (Date.parse(b.start) - Date.parse(a.start)) * dir
          break
        case 'upload':
          comparator = (a, b) => (a.upload - b.upload) * dir
          break
        case 'download':
          comparator = (a, b) => (a.download - b.download) * dir
          break
        case 'uploadSpeed':
          comparator = (a, b) => ((a.uploadSpeed || 0) - (b.uploadSpeed || 0)) * dir
          break
        case 'downloadSpeed':
          comparator = (a, b) => ((a.downloadSpeed || 0) - (b.downloadSpeed || 0)) * dir
          break
        case 'process':
          comparator = (a, b) =>
            (a.metadata.process || '').localeCompare(b.metadata.process || '') * dir
          break
        default:
          return filtered
      }
      filtered = [...filtered].sort(comparator)
    }

    return filtered
  }, [
    activeConnections,
    closedConnections,
    filter,
    compiledFilter,
    connectionDirection,
    connectionOrderBy,
    tab
  ])

  allConnectionsRef.current = allConnections
  activeConnectionsRef.current = activeConnections
  deletedIdsRef.current = deletedIds
  filteredConnectionsRef.current = filteredConnections
  iconMapRef.current = iconMap
  appNameCacheRef.current = appNameCache

  const trashAllClosedConnection = useCallback((): void => {
    setClosedConnections((closedConns) => {
      if (closedConns.length === 0) return closedConns
      const trashIds = new Set(closedConns.map((conn) => conn.id))
      setDeletedIds((prev) => new Set([...prev, ...trashIds]))
      setAllConnections((allConns) => {
        const updatedConnections = allConns.filter((conn) => !trashIds.has(conn.id))
        cachedConnections = updatedConnections
        return updatedConnections
      })
      return []
    })
  }, [])

  const trashClosedConnection = useCallback((id: string): void => {
    setDeletedIds((prev) => new Set([...prev, id]))
    setAllConnections((allConns) => {
      const updatedConnections = allConns.filter((conn) => conn.id !== id)
      cachedConnections = updatedConnections
      return updatedConnections
    })
    setClosedConnections((closedConns) => closedConns.filter((conn) => conn.id !== id))
  }, [])

  const closeAllConnections = useCallback((): void => {
    tab === 'active' ? mihomoCloseConnections() : trashAllClosedConnection()
  }, [tab, trashAllClosedConnection])

  const closeConnection = useCallback(
    (id: string): void => {
      tab === 'active' ? mihomoCloseConnection(id) : trashClosedConnection(id)
    },
    [tab, trashClosedConnection]
  )

  useEffect(() => {
    const handleConnections = (_e: unknown, info: ControllerConnections): void => {
      if (pausedRef.current) return
      setConnectionsInfo(info)

      if (!info.connections) return

      const prevActiveMap = new Map(activeConnectionsRef.current.map((conn) => [conn.id, conn]))
      const existingConnectionIds = new Set(allConnectionsRef.current.map((conn) => conn.id))
      const speedRatio = 1000 / connectionInterval

      const now = Date.now()
      const activeConnIds = new Set(info.connections.map((conn) => conn.id))

      activeConnIds.forEach((id) => {
        lastActiveTime.current.set(id, now)
      })

      const activeConns = info.connections.map((conn) => {
        const preConn = prevActiveMap.get(conn.id)
        const downloadSpeed = preConn
          ? Math.max(0, Math.round((conn.download - preConn.download) * speedRatio))
          : 0
        const uploadSpeed = preConn
          ? Math.max(0, Math.round((conn.upload - preConn.upload) * speedRatio))
          : 0
        const metadata =
          conn.metadata.type === 'Inner'
            ? { ...conn.metadata, process: 'mihomo', processPath: 'mihomo' }
            : conn.metadata

        return {
          ...conn,
          metadata,
          isActive: true,
          downloadSpeed,
          uploadSpeed
        }
      })

      const newConnections = activeConns.filter(
        (conn) => !existingConnectionIds.has(conn.id) && !deletedIdsRef.current.has(conn.id)
      )

      const activeConnsMap = new Map(activeConns.map((ac) => [ac.id, ac]))

      if (newConnections.length > 0) {
        const updatedAllConnections = [...allConnectionsRef.current, ...newConnections]

        const allConns = updatedAllConnections.map((conn) => {
          const activeConn = activeConnsMap.get(conn.id)
          if (activeConn) return activeConn
          const lastActive = lastActiveTime.current.get(conn.id) || 0
          const isStillActive = now - lastActive < 1000
          return { ...conn, isActive: isStillActive, downloadSpeed: 0, uploadSpeed: 0 }
        })

        const closedConns = allConns.filter((conn) => !conn.isActive)

        setActiveConnections(activeConns)
        setClosedConnections(closedConns)
        const finalAllConnections = allConns.slice(-(activeConns.length + 200))
        setAllConnections(finalAllConnections)
        cachedConnections = finalAllConnections
      } else {
        const allConns = allConnectionsRef.current.map((conn) => {
          const activeConn = activeConnsMap.get(conn.id)
          if (activeConn) return activeConn
          const lastActive = lastActiveTime.current.get(conn.id) || 0
          const isStillActive = now - lastActive < 1000
          return { ...conn, isActive: isStillActive, downloadSpeed: 0, uploadSpeed: 0 }
        })

        const closedConns = allConns.filter((conn) => !conn.isActive)

        setActiveConnections(activeConns)
        setClosedConnections(closedConns)
        setAllConnections(allConns)
        cachedConnections = allConns
      }
    }

    window.electron.ipcRenderer.on('mihomoConnections', handleConnections)

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoConnections')
    }
  }, [connectionInterval])

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const processAppNameQueue = useCallback(async () => {
    if (processingAppNames.current.size >= 3 || appNameRequestQueue.current.size === 0) return

    const pathsToProcess = Array.from(appNameRequestQueue.current).slice(0, 3)
    pathsToProcess.forEach((path) => appNameRequestQueue.current.delete(path))

    const promises = pathsToProcess.map(async (path) => {
      if (processingAppNames.current.has(path)) return
      processingAppNames.current.add(path)

      try {
        const appName = await getAppName(path)
        if (appName) {
          setAppNameCache((prev) => ({ ...prev, [path]: appName }))
        }
      } catch {
        // ignore
      } finally {
        processingAppNames.current.delete(path)
      }
    })

    await Promise.all(promises)

    if (appNameRequestQueue.current.size > 0) {
      processAppNameTimer.current = setTimeout(processAppNameQueue, 100)
    }
  }, [])

  const processIconQueue = useCallback(async () => {
    if (processingIcons.current.size >= 5 || iconRequestQueue.current.size === 0) return

    const pathsToProcess = Array.from(iconRequestQueue.current).slice(0, 5)
    pathsToProcess.forEach((path) => iconRequestQueue.current.delete(path))

    const promises = pathsToProcess.map(async (path) => {
      if (processingIcons.current.has(path)) return
      processingIcons.current.add(path)

      try {
        const rawBase64 = await getIconDataURL(path)
        if (!rawBase64) return

        const fullDataURL = rawBase64.startsWith('data:')
          ? rawBase64
          : `data:image/png;base64,${rawBase64}`

        let processedDataURL = fullDataURL
        if (platform != 'darwin') {
          processedDataURL = await cropAndPadTransparent(fullDataURL)
        }

        try {
          localStorage.setItem(path, processedDataURL)
        } catch {
          // ignore
        }

        setIconMap((prev) => ({ ...prev, [path]: processedDataURL }))

        const firstConnection = filteredConnectionsRef.current[0]
        if (firstConnection?.metadata.processPath === path) {
          setFirstItemRefreshTrigger((prev) => prev + 1)
        }
      } catch {
        // ignore
      } finally {
        processingIcons.current.delete(path)
      }
    })

    await Promise.all(promises)

    if (iconRequestQueue.current.size > 0) {
      processIconTimer.current = setTimeout(processIconQueue, 50)
    }
  }, [])

  useEffect(() => {
    if (!displayIcon || findProcessMode === 'off') return

    const visiblePaths = new Set<string>()
    const otherPaths = new Set<string>()
    let loadOtherPathsTimer: ReturnType<typeof setTimeout> | null = null

    const visibleConnections = filteredConnectionsRef.current.slice(0, 20)
    visibleConnections.forEach((c) => {
      const path = c.metadata.processPath || ''
      if (!path) return
      visiblePaths.add(path)
    })

    const collectPaths = (connections: ControllerConnectionDetail[]) => {
      for (const c of connections) {
        const path = c.metadata.processPath || ''
        if (!path) continue
        if (!visiblePaths.has(path)) {
          otherPaths.add(path)
        }
      }
    }

    collectPaths(activeConnections)
    collectPaths(closedConnections)

    const loadIcon = (path: string, isVisible: boolean = false): void => {
      if (!path) return
      if (iconMapRef.current[path] || processingIcons.current.has(path)) return

      const fromStorage = localStorage.getItem(path)
      if (fromStorage) {
        setIconMap((prev) => ({ ...prev, [path]: fromStorage }))
        if (isVisible && filteredConnectionsRef.current[0]?.metadata.processPath === path) {
          setFirstItemRefreshTrigger((prev) => prev + 1)
        }
        return
      }

      iconRequestQueue.current.add(path)
    }

    const loadAppName = (path: string): void => {
      if (!path) return
      if (appNameCacheRef.current[path] || processingAppNames.current.has(path)) return
      appNameRequestQueue.current.add(path)
    }

    visiblePaths.forEach((path) => {
      loadIcon(path, true)
      if (displayAppName) loadAppName(path)
    })

    if (otherPaths.size > 0) {
      const loadOtherPaths = () => {
        otherPaths.forEach((path) => {
          loadIcon(path, false)
          if (displayAppName) loadAppName(path)
        })
      }

      loadOtherPathsTimer = setTimeout(loadOtherPaths, 100)
    }

    if (processIconTimer.current) clearTimeout(processIconTimer.current)
    if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)

    processIconTimer.current = setTimeout(processIconQueue, 10)
    if (displayAppName) {
      processAppNameTimer.current = setTimeout(processAppNameQueue, 10)
    }

    return (): void => {
      if (loadOtherPathsTimer) clearTimeout(loadOtherPathsTimer)
      if (processIconTimer.current) clearTimeout(processIconTimer.current)
      if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
    }
  }, [activeConnections, closedConnections, displayIcon, displayAppName, findProcessMode])

  const handleTabChange = useCallback((key: Key) => {
    setTab(key as string)
  }, [])

  const handleOrderByChange = useCallback(
    async (v: unknown) => {
      await patchAppConfig({
        connectionOrderBy: (v as { currentKey: string }).currentKey as
          | 'time'
          | 'upload'
          | 'download'
          | 'uploadSpeed'
          | 'downloadSpeed'
          | 'process'
      })
    },
    [patchAppConfig]
  )

  const handleDirectionToggle = useCallback(async () => {
    await patchAppConfig({
      connectionDirection: connectionDirection === 'asc' ? 'desc' : 'asc'
    })
  }, [connectionDirection, patchAppConfig])

  const syncFilterCursor = useCallback((fallback?: number) => {
    const nextCursor = filterInputRef.current?.selectionStart ?? fallback ?? 0
    const nextScrollLeft = filterInputRef.current?.scrollLeft ?? 0
    setFilterCursor(nextCursor)
    setFilterScrollLeft(nextScrollLeft)
  }, [])

  const applyFilterSuggestion = useCallback(
    (input: HTMLInputElement, nextValue: string, nextCursor: number) => {
      flushSync(() => {
        setFilter(nextValue)
        setFilterCursor(nextCursor)
        setIsFilterFocused(true)
      })

      const restoreCaret = () => {
        const activeInput = filterInputRef.current
        if (!activeInput) {
          suppressSelectRef.current = false
          return
        }

        if (document.activeElement !== activeInput) {
          activeInput.focus()
        }

        activeInput.setSelectionRange(nextCursor, nextCursor, 'forward')
        activeInput.scrollLeft = activeInput.scrollWidth
        suppressSelectRef.current = false
        syncFilterCursor(nextCursor)
      }

      // Reuse the actively typing input element instead of re-focusing first.
      suppressSelectRef.current = true
      input.setSelectionRange(nextCursor, nextCursor, 'forward')
      input.scrollLeft = input.scrollWidth
      setFilterCursor(nextCursor)
      setFilterScrollLeft(input.scrollLeft)
      requestAnimationFrame(restoreCaret)
    },
    [syncFilterCursor]
  )

  const handleFilterValueChange = useCallback(
    (value: string) => {
      setCompletionSession(null)
      setFilter(value)
      requestAnimationFrame(() => syncFilterCursor(value.length))
    },
    [syncFilterCursor]
  )

  const handleFilterSelect = useCallback(
    (event: React.SyntheticEvent<HTMLInputElement>) => {
      event.stopPropagation()

      if (suppressSelectRef.current) {
        return
      }

      setCompletionSession(null)
      syncFilterCursor()
    },
    [syncFilterCursor]
  )

  useEffect(() => {
    const inputElement = filterInputRef.current
    if (!inputElement) return

    const handleScroll = () => syncFilterCursor()
    inputElement.addEventListener('scroll', handleScroll)

    return () => {
      inputElement.removeEventListener('scroll', handleScroll)
    }
  }, [syncFilterCursor])

  const handleFilterKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing) return

      if (event.key === 'Tab') {
        event.preventDefault()
        event.stopPropagation()
        event.nativeEvent.stopImmediatePropagation?.()

        const currentInput = event.currentTarget
        const currentValue = event.currentTarget.value
        const currentCursor = event.currentTarget.selectionStart ?? filterCursor
        const isCurrentSessionActive = isConnectionFilterCompletionSessionActive(
          completionSession,
          currentValue,
          currentCursor
        )

        if (isCurrentSessionActive && completionSession) {
          const total = completionSession.suggestions.length
          const direction = event.shiftKey ? -1 : 1
          const nextIndex = (completionSession.currentIndex + direction + total) % total
          const nextSuggestion = completionSession.suggestions[nextIndex]
          const { nextCursor, nextValue } = buildConnectionFilterSuggestionResult(
            completionSession.baseValue,
            nextSuggestion
          )

          setCompletionSession({ ...completionSession, currentIndex: nextIndex })
          applyFilterSuggestion(currentInput, nextValue, nextCursor)
          return
        }

        const nextSuggestions = getEnhancedConnectionFilterSuggestions(currentValue, currentCursor)
        if (nextSuggestions.length === 0) {
          setCompletionSession(null)
          return
        }

        const nextIndex = event.shiftKey ? nextSuggestions.length - 1 : 0
        const nextSuggestion = nextSuggestions[nextIndex]
        const { nextCursor, nextValue } = buildConnectionFilterSuggestionResult(
          currentValue,
          nextSuggestion
        )

        setCompletionSession({
          baseValue: currentValue,
          currentIndex: nextIndex,
          suggestions: nextSuggestions
        })
        applyFilterSuggestion(currentInput, nextValue, nextCursor)
        return
      }

      if (event.key === 'Escape') {
        setCompletionSession(null)
      }
    },
    [applyFilterSuggestion, completionSession, filterCursor]
  )

  const renderConnectionItem = useCallback(
    (i: number, connection: ControllerConnectionDetail) => {
      const path = connection.metadata.processPath || ''
      const iconUrl = (displayIcon && findProcessMode !== 'off' && iconMap[path]) || ''
      const itemKey = i === 0 ? `${connection.id}-${firstItemRefreshTrigger}` : connection.id
      const displayName =
        displayAppName && connection.metadata.processPath
          ? appNameCache[connection.metadata.processPath]
          : undefined

      return (
        <ConnectionItem
          setSelected={setSelected}
          setIsDetailModalOpen={setIsDetailModalOpen}
          selected={selected}
          iconUrl={iconUrl}
          displayIcon={displayIcon && findProcessMode !== 'off'}
          displayName={displayName}
          close={closeConnection}
          index={i}
          key={itemKey}
          info={connection}
        />
      )
    },
    [
      displayIcon,
      iconMap,
      firstItemRefreshTrigger,
      selected,
      closeConnection,
      appNameCache,
      findProcessMode,
      displayAppName
    ]
  )

  return (
    <BasePage
      title="连接"
      header={
        <>
          <div className="flex">
            <div className="flex items-center">
              <span className="mx-1 text-gray-400">
                ↑ {calcTraffic(connectionsInfo?.uploadTotal ?? 0)}{' '}
              </span>
              <span className="mx-1 text-gray-400">
                ↓ {calcTraffic(connectionsInfo?.downloadTotal ?? 0)}{' '}
              </span>
            </div>
            <Badge
              className="mt-2"
              color="primary"
              variant="flat"
              showOutline={false}
              content={filteredConnections.length}
            >
              <Button
                className="app-nodrag ml-1"
                isIconOnly
                size="sm"
                variant="light"
                onPress={() => {
                  if (filter === '') {
                    closeAllConnections()
                  } else {
                    filteredConnections.forEach((conn) => {
                      closeConnection(conn.id)
                    })
                  }
                }}
              >
                {tab === 'active' ? (
                  <CgClose className="text-lg" />
                ) : (
                  <CgTrash className="text-lg" />
                )}
              </Button>
            </Badge>
          </div>
          <Button
            size="sm"
            isIconOnly
            className="app-nodrag ml-2"
            variant="light"
            onPress={() =>
              setPaused((p) => {
                pausedRef.current = !p
                return !p
              })
            }
          >
            {paused ? <IoPlay className="text-lg" /> : <IoPause className="text-lg" />}
          </Button>
          <Button
            size="sm"
            isIconOnly
            className="app-nodrag"
            variant="light"
            onPress={() => setIsSettingModalOpen(true)}
          >
            <MdTune className="text-lg" />
          </Button>
        </>
      }
    >
      {isDetailModalOpen && selected && (
        <ConnectionDetailModal onClose={() => setIsDetailModalOpen(false)} connection={selected} />
      )}
      {isSettingModalOpen && (
        <ConnectionSettingModal onClose={() => setIsSettingModalOpen(false)} />
      )}
      <div className="overflow-x-auto sticky top-0 z-40">
        <div className="flex p-2 gap-2">
          <Tabs
            size="sm"
            color={tab === 'active' ? 'primary' : 'danger'}
            selectedKey={tab}
            variant="underlined"
            className="w-fit h-8"
            onSelectionChange={handleTabChange}
          >
            <Tab
              key="active"
              title={
                <Badge
                  color={tab === 'active' ? 'primary' : 'default'}
                  size="sm"
                  shape="circle"
                  variant="flat"
                  content={activeConnections.length}
                  showOutline={false}
                >
                  <span className="p-1">活动中</span>
                </Badge>
              }
            />
            <Tab
              key="closed"
              title={
                <Badge
                  color={tab === 'closed' ? 'danger' : 'default'}
                  size="sm"
                  shape="circle"
                  variant="flat"
                  content={closedConnections.length}
                  showOutline={false}
                >
                  <span className="p-1">已关闭</span>
                </Badge>
              }
            />
          </Tabs>
          <Tooltip
            content={compiledFilter.error ?? '格式错误'}
            placement="left"
            isOpen={Boolean(compiledFilter.error)}
            showArrow={true}
            color="danger"
            offset={10}
          >
            <div className="relative min-w-0 flex-1">
              <Input
                ref={filterInputRef}
                variant="flat"
                size="sm"
                className={
                  compiledFilter.error ? 'border-red-500 ring-1 ring-red-500 rounded-lg' : ''
                }
                classNames={{
                  inputWrapper:
                    'relative h-8 px-3 group-data-[focus-visible=true]:!ring-0 group-data-[focus-visible=true]:!ring-transparent group-data-[focus-visible=true]:!ring-offset-0',
                  innerWrapper: 'overflow-hidden',
                  input: 'font-mono text-sm tracking-normal focus-visible:!outline-none'
                }}
                value={filter}
                placeholder="筛选过滤"
                isClearable
                isInvalid={Boolean(compiledFilter.error)}
                onValueChange={handleFilterValueChange}
                onKeyDown={handleFilterKeyDown}
                onFocus={() => {
                  setIsFilterFocused(true)
                  requestAnimationFrame(() => syncFilterCursor())
                }}
                onBlur={() => {
                  setCompletionSession(null)
                  requestAnimationFrame(() => {
                    const activeElement = document.activeElement
                    if (activeElement !== filterInputRef.current) {
                      setIsFilterFocused(false)
                    }
                  })
                }}
                onClick={() => {
                  setCompletionSession(null)
                  syncFilterCursor()
                }}
                onKeyUp={() => syncFilterCursor()}
                onSelect={handleFilterSelect}
              />
              {inlineCompletionSuffix ? (
                <div className="pointer-events-none absolute top-1/2 left-3 right-10 z-10 flex -translate-y-1/2 items-center overflow-hidden font-mono text-sm tracking-normal">
                  <div
                    className="flex items-center whitespace-pre"
                    style={{ transform: `translateX(-${filterScrollLeft}px)` }}
                  >
                    <span className="invisible whitespace-pre">{filter}</span>
                    <span className="whitespace-pre text-foreground-400/55">
                      {inlineCompletionSuffix}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </Tooltip>

          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            size="sm"
            className="w-34 min-w-24 shrink-0"
            selectedKeys={new Set([connectionOrderBy])}
            disallowEmptySelection={true}
            onSelectionChange={handleOrderByChange}
          >
            <SelectItem key="upload">上传量</SelectItem>
            <SelectItem key="download">下载量</SelectItem>
            <SelectItem key="uploadSpeed">上传速度</SelectItem>
            <SelectItem key="downloadSpeed">下载速度</SelectItem>
            <SelectItem key="time">时间</SelectItem>
            <SelectItem key="process">进程名称</SelectItem>
          </Select>
          <Button size="sm" isIconOnly className="bg-content2" onPress={handleDirectionToggle}>
            {connectionDirection === 'asc' ? (
              <HiSortAscending className="text-lg" />
            ) : (
              <HiSortDescending className="text-lg" />
            )}
          </Button>
        </div>
        <Divider />
      </div>
      <div className="h-[calc(100vh-100px)] mt-px">
        <Virtuoso data={filteredConnections} itemContent={renderConnectionItem} />
      </div>
    </BasePage>
  )
}

export default Connections
