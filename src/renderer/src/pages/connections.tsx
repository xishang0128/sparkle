import BasePage from '@renderer/components/base/base-page'
import { mihomoCloseConnections, mihomoCloseConnection } from '@renderer/utils/ipc'
import React, { Key, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Divider, Input, Select, SelectItem, Tab, Tabs } from '@heroui/react'
import { calcTraffic } from '@renderer/utils/calc'
import ConnectionItem from '@renderer/components/connections/connection-item'
import { Virtuoso } from 'react-virtuoso'
import dayjs from 'dayjs'
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

let cachedConnections: ControllerConnectionDetail[] = []

const Connections: React.FC = () => {
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'find-process-mode': findProcessMode = 'always' } = controledMihomoConfig || {}
  const [filter, setFilter] = useState('')
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    connectionDirection = 'asc',
    connectionOrderBy = 'time',
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
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const iconRequestQueue = useRef(new Set<string>())
  const processingIcons = useRef(new Set<string>())
  const processIconTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const appNameRequestQueue = useRef(new Set<string>())
  const processingAppNames = useRef(new Set<string>())
  const processAppNameTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lastActiveTime = useRef<Map<string, number>>(new Map())

  const filteredConnections = useMemo(() => {
    const connections = tab === 'active' ? activeConnections : closedConnections

    let filtered = connections
    if (filter !== '') {
      filtered = connections.filter((connection) => {
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

        return includesIgnoreCase(searchableFields, filter)
      })
    }

    if (connectionOrderBy) {
      filtered = [...filtered].sort((a, b) => {
        if (connectionDirection === 'asc') {
          switch (connectionOrderBy) {
            case 'time':
              return dayjs(b.start).unix() - dayjs(a.start).unix()
            case 'upload':
              return a.upload - b.upload
            case 'download':
              return a.download - b.download
            case 'uploadSpeed':
              return (a.uploadSpeed || 0) - (b.uploadSpeed || 0)
            case 'downloadSpeed':
              return (a.downloadSpeed || 0) - (b.downloadSpeed || 0)
            case 'process':
              return (a.metadata.process || '').localeCompare(b.metadata.process || '')
          }
        } else {
          switch (connectionOrderBy) {
            case 'time':
              return dayjs(a.start).unix() - dayjs(b.start).unix()
            case 'upload':
              return b.upload - a.upload
            case 'download':
              return b.download - a.download
            case 'uploadSpeed':
              return (b.uploadSpeed || 0) - (a.uploadSpeed || 0)
            case 'downloadSpeed':
              return (b.downloadSpeed || 0) - (a.downloadSpeed || 0)
            case 'process':
              return (b.metadata.process || '').localeCompare(a.metadata.process || '')
          }
        }
      })
    }

    return filtered
  }, [activeConnections, closedConnections, filter, connectionDirection, connectionOrderBy, tab])

  const trashAllClosedConnection = useCallback((): void => {
    if (closedConnections.length === 0) return

    const trashIds = closedConnections.map((conn) => conn.id)
    setDeletedIds((prev) => new Set([...prev, ...trashIds]))
    setAllConnections((allConns) => {
      const updatedConnections = allConns.filter((conn) => !trashIds.includes(conn.id))
      cachedConnections = updatedConnections
      return updatedConnections
    })
    setClosedConnections([])
  }, [closedConnections])

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
      setConnectionsInfo(info)

      if (!info.connections) return

      const prevActiveMap = new Map(activeConnections.map((conn) => [conn.id, conn]))
      const existingConnectionIds = new Set(allConnections.map((conn) => conn.id))

      const now = Date.now()
      const activeConnIds = new Set(info.connections.map((conn) => conn.id))

      activeConnIds.forEach((id) => {
        lastActiveTime.current.set(id, now)
      })

      const activeConns = info.connections.map((conn) => {
        const preConn = prevActiveMap.get(conn.id)
        const downloadSpeed = preConn ? conn.download - preConn.download : 0
        const uploadSpeed = preConn ? conn.upload - preConn.upload : 0
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
        (conn) => !existingConnectionIds.has(conn.id) && !deletedIds.has(conn.id)
      )

      if (newConnections.length > 0) {
        const updatedAllConnections = [...allConnections, ...newConnections]

        const allConns = updatedAllConnections.map((conn) => {
          const activeConn = activeConns.find((ac) => ac.id === conn.id)
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
        const allConns = allConnections.map((conn) => {
          const activeConn = activeConns.find((ac) => ac.id === conn.id)
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
  }, [allConnections, activeConnections, closedConnections, deletedIds])

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

        const firstConnection = filteredConnections[0]
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
  }, [filteredConnections])

  useEffect(() => {
    if (!displayIcon || findProcessMode === 'off') return

    const visiblePaths = new Set<string>()
    const otherPaths = new Set<string>()

    const visibleConnections = filteredConnections.slice(0, 20)
    visibleConnections.forEach((c) => {
      const path = c.metadata.processPath || ''
      visiblePaths.add(path)
    })

    const collectPaths = (connections: ControllerConnectionDetail[]) => {
      for (const c of connections) {
        const path = c.metadata.processPath || ''
        if (!visiblePaths.has(path)) {
          otherPaths.add(path)
        }
      }
    }

    collectPaths(activeConnections)
    collectPaths(closedConnections)

    const loadIcon = (path: string, isVisible: boolean = false): void => {
      if (iconMap[path] || processingIcons.current.has(path)) return

      const fromStorage = localStorage.getItem(path)
      if (fromStorage) {
        setIconMap((prev) => ({ ...prev, [path]: fromStorage }))
        if (isVisible && filteredConnections[0]?.metadata.processPath === path) {
          setFirstItemRefreshTrigger((prev) => prev + 1)
        }
        return
      }

      iconRequestQueue.current.add(path)
    }

    const loadAppName = (path: string): void => {
      if (appNameCache[path] || processingAppNames.current.has(path)) return
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

      setTimeout(loadOtherPaths, 100)
    }

    if (processIconTimer.current) clearTimeout(processIconTimer.current)
    if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)

    processIconTimer.current = setTimeout(processIconQueue, 10)
    if (displayAppName) {
      processAppNameTimer.current = setTimeout(processAppNameQueue, 10)
    }

    return (): void => {
      if (processIconTimer.current) clearTimeout(processIconTimer.current)
      if (processAppNameTimer.current) clearTimeout(processAppNameTimer.current)
    }
  }, [
    activeConnections,
    closedConnections,
    iconMap,
    appNameCache,
    displayIcon,
    filteredConnections,
    processIconQueue,
    processAppNameQueue,
    displayAppName
  ])

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
                title={tab === 'active' ? '关闭全部连接' : '清空已关闭连接'}
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
            title="连接设置"
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
            className="w-fit h-[32px]"
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
          <Input
            variant="flat"
            size="sm"
            value={filter}
            placeholder="筛选过滤"
            isClearable
            onValueChange={setFilter}
          />

          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            size="sm"
            className="w-[180px] min-w-[120px]"
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
