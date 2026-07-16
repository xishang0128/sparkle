import { Button, Drawer, InputGroup, ListBox, Select, Switch } from '@heroui-v3/react'
import React, { useEffect, useRef, useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { settingItemProps } from '../base/base-controls'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartMihomoConnections } from '@renderer/utils/ipc'
import { HiSortAscending, HiSortDescending } from 'react-icons/hi'

interface Props {
  onClose: () => void
  reopenSignal?: number
}

const DRAWER_CLOSE_ANIMATION_MS = 700

const ConnectionSettingDrawer: React.FC<Props> = (props) => {
  const { onClose, reopenSignal } = props
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    displayIcon = true,
    displayAppName = true,
    connectionInterval = 500,
    connectionGroupByProcess = false,
    connectionGroupSort = 'name',
    connectionGroupDirection = 'asc'
  } = appConfig || {}
  const [intervalInput, setIntervalInput] = useState(connectionInterval)
  const [isOpen, setIsOpen] = useState(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setIsOpen(true)
  }, [reopenSignal])

  const closeWithAnimation = (): void => {
    if (closeTimer.current) return

    setIsOpen(false)
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      onClose()
    }, DRAWER_CLOSE_ANIMATION_MS)
  }

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) closeWithAnimation()
      }}
      variant="blur"
      className="top-12 h-[calc(100%-48px)]"
    >
      <Drawer.Content placement="right" className="top-12 h-[calc(100%-48px)] p-3 pl-0">
        <Drawer.Dialog className="flex h-full w-[min(460px,calc(100vw-32px))] max-w-none flex-col overflow-hidden rounded-2xl! border border-separator/70 bg-overlay p-0 shadow-overlay flag-emoji">
          <Drawer.Header className="border-b border-separator/70 px-5 py-4">
            <Drawer.Heading className="text-base font-semibold">连接设置</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="no-scrollbar flex-1 overflow-y-auto px-5 py-3">
            <div className="flex flex-col gap-1">
              <SettingItem title="显示应用图标" {...settingItemProps} divider>
                <Switch
                  aria-label="显示应用图标"
                  isSelected={displayIcon}
                  onChange={(v) => {
                    patchAppConfig({ displayIcon: v })
                  }}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </SettingItem>
              <SettingItem title="显示应用名称" {...settingItemProps} divider>
                <Switch
                  aria-label="显示应用名称"
                  isSelected={displayAppName}
                  onChange={(v) => {
                    patchAppConfig({ displayAppName: v })
                  }}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </SettingItem>
              <SettingItem title="进程归类" {...settingItemProps} divider>
                <Switch
                  aria-label="进程归类"
                  isSelected={connectionGroupByProcess}
                  onChange={(v) => {
                    patchAppConfig({ connectionGroupByProcess: v })
                  }}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </SettingItem>
              {connectionGroupByProcess && (
                <SettingItem title="归类排序" {...settingItemProps} divider>
                  <div className="flex items-center justify-end gap-2">
                    <Select
                      aria-label="归类排序字段"
                      className="w-24"
                      variant="secondary"
                      value={connectionGroupSort}
                      onChange={(value) => {
                        if (Array.isArray(value) || value == null) return
                        if (value === connectionGroupSort) return
                        patchAppConfig({
                          connectionGroupSort: value as
                            | 'name'
                            | 'count'
                            | 'upload'
                            | 'download'
                            | 'uploadSpeed'
                            | 'downloadSpeed'
                        })
                      }}
                    >
                      <Select.Trigger className="h-8 min-h-8 py-0">
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="name" textValue="名称">
                            名称
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="count" textValue="连接数">
                            连接数
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="upload" textValue="上传量">
                            上传量
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="download" textValue="下载量">
                            下载量
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="uploadSpeed" textValue="上传速度">
                            上传速度
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="downloadSpeed" textValue="下载速度">
                            下载速度
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Button
                      size="sm"
                      isIconOnly
                      variant="secondary"
                      className="h-8 w-8 shrink-0"
                      aria-label={connectionGroupDirection === 'asc' ? '升序' : '降序'}
                      onPress={() => {
                        patchAppConfig({
                          connectionGroupDirection:
                            connectionGroupDirection === 'asc' ? 'desc' : 'asc'
                        })
                      }}
                    >
                      {connectionGroupDirection === 'asc' ? (
                        <HiSortAscending className="text-lg" />
                      ) : (
                        <HiSortDescending className="text-lg" />
                      )}
                    </Button>
                  </div>
                </SettingItem>
              )}
              <SettingItem title="刷新间隔" {...settingItemProps}>
                <div className="setting-item__inline-controls">
                  {intervalInput !== connectionInterval && (
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => {
                        const actualValue = Math.min(10000, Math.max(100, intervalInput))
                        setIntervalInput(actualValue)
                        patchAppConfig({ connectionInterval: actualValue })
                        restartMihomoConnections()
                      }}
                    >
                      确认
                    </Button>
                  )}
                  <InputGroup variant="secondary">
                    <InputGroup.Input
                      aria-label="刷新间隔"
                      type="number"
                      value={intervalInput.toString()}
                      max={10000}
                      min={100}
                      onChange={(event) => {
                        setIntervalInput(parseInt(event.target.value) || 100)
                      }}
                    />
                    <InputGroup.Suffix>ms</InputGroup.Suffix>
                  </InputGroup>
                </div>
              </SettingItem>
            </div>
          </Drawer.Body>
          <Drawer.CloseTrigger className="app-nodrag" />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}

export default ConnectionSettingDrawer
