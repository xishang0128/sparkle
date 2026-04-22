import BasePage from '@renderer/components/base/base-page'
import LogItem from '@renderer/components/logs/log-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Divider, Input } from '@heroui/react'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { IoLocationSharp } from 'react-icons/io5'
import { CgTrash } from 'react-icons/cg'

import { includesIgnoreCase } from '@renderer/utils/includes'
import {
  clearMihomoLogs,
  getMihomoLogs,
  type MihomoLogEntry,
  setMihomoLogMaxEntries,
  subscribeMihomoLogs
} from '@renderer/utils/mihomo-log-store'
import { ListBox, Select } from '@heroui-v3/react'

const logLevelOrder: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warning: 2,
  info: 3,
  debug: 4
}

const Logs: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { maxLogEntries = 500 } = appConfig || {}
  const { 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const [logs, setLogs] = useState<MihomoLogEntry[]>(() => getMihomoLogs())
  const [filter, setFilter] = useState('')
  const [trace, setTrace] = useState(true)
  const [logLevelFilter, setLogLevelFilter] = useState<LogLevel | null>(null)
  const [freshLogIds, setFreshLogIds] = useState<string[]>([])

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const freshLogTimeoutsRef = useRef<Map<string, number>>(new Map())
  const hasHydratedLogsRef = useRef(false)
  const previousLogIdsRef = useRef<string[]>([])
  const activeLogLevelFilter = logLevelFilter ?? logLevel
  const freshLogIdSet = useMemo(() => new Set(freshLogIds), [freshLogIds])
  const logsByLevel = useMemo(() => {
    if (activeLogLevelFilter === 'silent') return []
    return logs.filter((log) => logLevelOrder[log.type] <= logLevelOrder[activeLogLevelFilter])
  }, [logs, activeLogLevelFilter])
  const filteredLogs = useMemo(() => {
    if (filter === '') return logsByLevel
    return logsByLevel.filter((log) => {
      return includesIgnoreCase(log.payload, filter) || includesIgnoreCase(log.type, filter)
    })
  }, [logsByLevel, filter])

  const clearFreshLogTimers = (logIds?: string[]): void => {
    if (!logIds) {
      freshLogTimeoutsRef.current.forEach((timeout) => {
        window.clearTimeout(timeout)
      })
      freshLogTimeoutsRef.current.clear()
      return
    }

    logIds.forEach((id) => {
      const timeout = freshLogTimeoutsRef.current.get(id)
      if (!timeout) return

      window.clearTimeout(timeout)
      freshLogTimeoutsRef.current.delete(id)
    })
  }

  useEffect(() => {
    if (!trace || filteredLogs.length === 0) return
    virtuosoRef.current?.scrollToIndex({
      index: filteredLogs.length - 1,
      behavior: 'smooth',
      align: 'end',
      offset: 0
    })
  }, [filteredLogs, trace])

  useEffect(() => {
    return subscribeMihomoLogs(setLogs)
  }, [])

  useEffect(() => {
    return () => {
      clearFreshLogTimers()
    }
  }, [])

  useEffect(() => {
    const currentLogIds = logs.map((log) => log.id)

    if (!hasHydratedLogsRef.current) {
      hasHydratedLogsRef.current = true
      previousLogIdsRef.current = currentLogIds
      return
    }

    if (currentLogIds.length === 0) {
      previousLogIdsRef.current = []
      clearFreshLogTimers()
      setFreshLogIds([])
      return
    }

    const previousLogIdSet = new Set(previousLogIdsRef.current)
    const addedLogIds = currentLogIds.filter((id) => !previousLogIdSet.has(id))

    previousLogIdsRef.current = currentLogIds
    if (addedLogIds.length === 0) return

    setFreshLogIds((prev) => Array.from(new Set([...prev, ...addedLogIds])))

    addedLogIds.forEach((id) => {
      clearFreshLogTimers([id])

      const timeout = window.setTimeout(() => {
        freshLogTimeoutsRef.current.delete(id)
        setFreshLogIds((prev) => prev.filter((currentId) => currentId !== id))
      }, 360)

      freshLogTimeoutsRef.current.set(id, timeout)
    })
  }, [logs])

  useEffect(() => {
    setMihomoLogMaxEntries(maxLogEntries)
  }, [maxLogEntries])

  return (
    <BasePage title="实时日志" contentClassName="overflow-y-hidden">
      <div className="flex h-full min-h-0 flex-col">
        <div className="sticky top-0 z-40">
          <div className="flex w-full items-center gap-2 p-2">
            <Input
              size="sm"
              value={filter}
              placeholder="筛选过滤"
              isClearable
              onValueChange={setFilter}
            />
            <Select
              aria-label="日志等级过滤"
              className="w-24 shrink-0"
              placeholder="日志等级"
              value={activeLogLevelFilter}
              variant="secondary"
              onChange={(value) => {
                if (Array.isArray(value) || value == null) return
                setLogLevelFilter(value as LogLevel)
              }}
            >
              <Select.Trigger className="h-8 min-h-8 rounded-lg px-3 text-sm">
                <Select.Value className="-translate-y-px" />
                <Select.Indicator className="size-4" />
              </Select.Trigger>
              <Select.Popover className="min-w-0 rounded-lg">
                <ListBox className="w-24 rounded-lg p-1 text-sm">
                  <ListBox.Item
                    id="silent"
                    textValue="静默"
                    className="min-h-8 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    静默
                    <ListBox.ItemIndicator className="size-3.5" />
                  </ListBox.Item>
                  <ListBox.Item
                    id="error"
                    textValue="错误"
                    className="min-h-8 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    错误
                    <ListBox.ItemIndicator className="size-3.5" />
                  </ListBox.Item>
                  <ListBox.Item
                    id="warning"
                    textValue="警告"
                    className="min-h-8 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    警告
                    <ListBox.ItemIndicator className="size-3.5" />
                  </ListBox.Item>
                  <ListBox.Item
                    id="info"
                    textValue="信息"
                    className="min-h-8 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    信息
                    <ListBox.ItemIndicator className="size-3.5" />
                  </ListBox.Item>
                  <ListBox.Item
                    id="debug"
                    textValue="调试"
                    className="min-h-8 rounded-md px-2.5 py-1.5 text-sm"
                  >
                    调试
                    <ListBox.ItemIndicator className="size-3.5" />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <Button
              size="sm"
              isIconOnly
              color={trace ? 'primary' : 'default'}
              variant={trace ? 'solid' : 'bordered'}
              onPress={() => {
                setTrace((prev) => !prev)
              }}
            >
              <IoLocationSharp className="text-lg" />
            </Button>
            <Button
              size="sm"
              isIconOnly
              title="清空日志"
              variant="light"
              color="danger"
              onPress={() => {
                clearMihomoLogs()
              }}
            >
              <CgTrash className="text-lg" />
            </Button>
          </div>
          <Divider />
        </div>
        <div className="min-h-0 flex-1 pt-2">
          <Virtuoso
            ref={virtuosoRef}
            className="h-full pr-1"
            data={filteredLogs}
            initialTopMostItemIndex={filteredLogs.length > 0 ? filteredLogs.length - 1 : undefined}
            followOutput={trace}
            computeItemKey={(_index, log) => log.id}
            itemContent={(i, log) => {
              return (
                <LogItem
                  index={i}
                  animateOnMount={freshLogIdSet.has(log.id)}
                  time={log.time}
                  type={log.type}
                  payload={log.payload}
                />
              )
            }}
          />
        </div>
      </div>
    </BasePage>
  )
}

export default Logs
