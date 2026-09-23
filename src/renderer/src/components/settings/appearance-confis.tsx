import { Button, Tooltip, Spinner, Select, Switch, Tabs, ListBox } from '@heroui/react'

import React, { useEffect, useState, useRef } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { BiSolidFileImport } from 'react-icons/bi'
import {
  applyTheme,
  closeFloatingWindow,
  closeTrayIcon,
  fetchThemes,
  getFilePath,
  importThemes,
  relaunchApp,
  readImageFileDataURL,
  resolveThemes,
  setDockVisible,
  showFloatingWindow,
  showTrayIcon,
  startMonitor,
  updateTrayIcon,
  writeTheme
} from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { useTheme } from 'next-themes'
import { IoIosHelpCircle, IoMdCloudDownload } from 'react-icons/io'
import { MdEditDocument } from 'react-icons/md'
import CSSEditorModal from './css-editor-modal'
import TrayIconCropModal from './tray-icon-crop-modal'
import { notify } from '@renderer/utils/notification'

const rasterTrayIconPattern = /\.(png|jpe?g|webp)$/i

const AppearanceConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const [customThemes, setCustomThemes] = useState<
    {
      key: string
      label: string
    }[]
  >()
  const [openCSSEditor, setOpenCSSEditor] = useState(false)
  const [trayIconCropDataURL, setTrayIconCropDataURL] = useState('')
  const [fetching, setFetching] = useState(false)
  const { setTheme } = useTheme()
  const {
    useDockIcon = true,
    showTraffic = false,
    proxyInTray = true,
    trayProxyDelayLayout = 'auto',
    customTrayIcon = '',
    disableTray = false,
    showFloatingWindow: showFloating = false,
    spinFloatingIcon = true,
    useWindowFrame = false,
    enableWindowDrag = false,
    showUpdateButtonAfterNotification = true,
    customTheme = 'default.css',
    appTheme = 'system'
  } = appConfig || {}
  const [localShowFloating, setLocalShowFloating] = useState(showFloating)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    resolveThemes().then((themes) => {
      setCustomThemes(themes)
    })
  }, [])

  useEffect(() => {
    return (): void => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      {openCSSEditor && (
        <CSSEditorModal
          theme={customTheme}
          onCancel={() => setOpenCSSEditor(false)}
          onConfirm={async (css: string) => {
            await writeTheme(customTheme, css)
            await applyTheme(customTheme)
            setOpenCSSEditor(false)
          }}
        />
      )}
      {trayIconCropDataURL && (
        <TrayIconCropModal
          imageDataURL={trayIconCropDataURL}
          onCancel={() => setTrayIconCropDataURL('')}
          onConfirm={async (dataURL) => {
            await patchAppConfig({ customTrayIcon: dataURL })
            setTrayIconCropDataURL('')
            await updateTrayIcon()
          }}
        />
      )}
      <SettingCard header="外观设置">
        <SettingItem
          compatKey="legacy"
          title="显示悬浮窗"
          actions={
            <Tooltip delay={0}>
              <Button isIconOnly size="sm" variant="ghost" data-color="default">
                <IoIosHelpCircle className="text-lg" />
              </Button>
              <Tooltip.Content>
                {'未禁用 GPU 加速的情况下，悬浮窗可能会导致应用崩溃'}
              </Tooltip.Content>
            </Tooltip>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={localShowFloating}
            onChange={async (v) => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
                timeoutRef.current = null
              }

              setLocalShowFloating(v)
              if (v) {
                await showFloatingWindow()
                timeoutRef.current = setTimeout(async () => {
                  await patchAppConfig({ showFloatingWindow: v })
                  timeoutRef.current = null
                }, 1000)
              } else {
                patchAppConfig({ showFloatingWindow: v })
                await closeFloatingWindow()
              }
            }}
            aria-label="显示悬浮窗"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        {localShowFloating && (
          <>
            <SettingItem compatKey="legacy" title="根据网速旋转悬浮窗图标" divider>
              <Switch
                size="sm"
                isSelected={spinFloatingIcon}
                onChange={async (v) => {
                  await patchAppConfig({ spinFloatingIcon: v })
                  window.electron.ipcRenderer.send('updateFloatingWindow')
                }}
                aria-label="根据网速旋转悬浮窗图标"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </SettingItem>
            <SettingItem compatKey="legacy" title="禁用托盘图标" divider>
              <Switch
                size="sm"
                isSelected={disableTray}
                onChange={async (v) => {
                  await patchAppConfig({ disableTray: v })
                  if (v) {
                    closeTrayIcon()
                  } else {
                    showTrayIcon()
                  }
                }}
                aria-label="禁用托盘图标"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </SettingItem>
          </>
        )}
        {!disableTray && (
          <SettingItem
            compatKey="legacy"
            title="自定义托盘图标"
            actions={
              <Tooltip delay={0}>
                <Button isIconOnly size="sm" variant="ghost" data-color="default">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
                <Tooltip.Content>
                  {
                    '设置后托盘会使用此图标；开启网速显示时会与网速合成。PNG、JPG、WebP 会先裁剪后保存。'
                  }
                </Tooltip.Content>
              </Tooltip>
            }
            divider
          >
            <div className="flex min-w-0 max-w-[65%] items-center justify-end gap-2">
              {customTrayIcon && (
                <span className="truncate text-xs text-default-500">
                  {customTrayIcon.startsWith('data:image/') ? '已储存自定义图标' : customTrayIcon}
                </span>
              )}
              <Button
                size="sm"
                onPress={async () => {
                  const files = await getFilePath(
                    ['png', 'jpg', 'jpeg', 'webp', 'ico', 'icns'],
                    '选择托盘图标',
                    '托盘图标'
                  )
                  if (!files?.[0]) return
                  if (rasterTrayIconPattern.test(files[0])) {
                    setTrayIconCropDataURL(await readImageFileDataURL(files[0]))
                    return
                  }
                  await patchAppConfig({ customTrayIcon: await readImageFileDataURL(files[0]) })
                  await updateTrayIcon()
                }}
                variant="secondary"
                data-color="default"
              >
                {customTrayIcon ? '更换图标' : '选择图标'}
              </Button>
              {customTrayIcon && (
                <Button
                  size="sm"
                  onPress={async () => {
                    await patchAppConfig({ customTrayIcon: '' })
                    await updateTrayIcon()
                  }}
                  variant="ghost"
                  data-color="default"
                >
                  恢复默认
                </Button>
              )}
            </div>
          </SettingItem>
        )}
        {platform !== 'linux' && (
          <>
            <SettingItem compatKey="legacy" title="托盘菜单显示节点信息" divider>
              <Switch
                size="sm"
                isSelected={proxyInTray}
                onChange={async (v) => {
                  await patchAppConfig({ proxyInTray: v })
                }}
                aria-label="托盘菜单显示节点信息"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </SettingItem>
            {proxyInTray && (
              <SettingItem compatKey="legacy" title="托盘菜单节点延迟显示方式" divider>
                <Tabs
                  selectedKey={trayProxyDelayLayout}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      trayProxyDelayLayout: v as 'same-line' | 'new-line'
                    })
                    window.electron.ipcRenderer.send('updateTrayMenu')
                  }}
                  data-color="primary"
                  data-size="sm"
                  data-full-width={false}
                >
                  <Tabs.ListContainer>
                    <Tabs.List aria-label="选项">
                      <Tabs.Tab key="same-line" id="same-line">
                        同一行
                        <Tabs.Indicator />
                      </Tabs.Tab>
                      <Tabs.Tab key="new-line" id="new-line">
                        换行
                        <Tabs.Indicator />
                      </Tabs.Tab>
                    </Tabs.List>
                  </Tabs.ListContainer>
                </Tabs>
              </SettingItem>
            )}
            <SettingItem
              compatKey="legacy"
              title={`${platform === 'win32' ? '任务栏' : '状态栏'}显示网速信息`}
              divider
            >
              <Switch
                size="sm"
                isSelected={showTraffic}
                onChange={async (v) => {
                  await patchAppConfig({ showTraffic: v })
                  await startMonitor()
                }}
                aria-label="启用"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </SettingItem>
          </>
        )}
        {platform === 'darwin' && (
          <>
            <SettingItem compatKey="legacy" title="显示 Dock 图标" divider>
              <Switch
                size="sm"
                isSelected={useDockIcon}
                onChange={async (v) => {
                  await patchAppConfig({ useDockIcon: v })
                  setDockVisible(v)
                }}
                aria-label="显示 Dock 图标"
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </SettingItem>
          </>
        )}
        <SettingItem compatKey="legacy" title="使用系统标题栏" divider>
          <Switch
            size="sm"
            isSelected={useWindowFrame}
            onChange={async (v) => {
              await patchAppConfig({ useWindowFrame: v })
              await relaunchApp()
            }}
            aria-label="使用系统标题栏"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        {useWindowFrame && (
          <SettingItem
            compatKey="legacy"
            title="启用窗口拖动区域"
            actions={
              <Tooltip delay={0}>
                <Button isIconOnly size="sm" variant="ghost" data-color="default">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
                <Tooltip.Content>
                  {'让应用内页面标题的空白区域可用于拖动窗口，适用于系统未提供可拖动标题栏的环境。'}
                </Tooltip.Content>
              </Tooltip>
            }
            divider
          >
            <Switch
              size="sm"
              isSelected={enableWindowDrag}
              onChange={async (v) => {
                await patchAppConfig({ enableWindowDrag: v })
                await relaunchApp()
              }}
              aria-label="启用窗口拖动区域"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
        )}
        <SettingItem compatKey="legacy" title="显示更新按钮" divider>
          <Switch
            size="sm"
            isSelected={showUpdateButtonAfterNotification}
            onChange={(v) => {
              patchAppConfig({ showUpdateButtonAfterNotification: v })
            }}
            aria-label="显示更新按钮"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        <SettingItem compatKey="legacy" title="背景色" divider>
          <Tabs
            selectedKey={appTheme}
            onSelectionChange={(key) => {
              setTheme(key.toString())
              patchAppConfig({ appTheme: key as AppTheme })
            }}
            data-color="primary"
            data-size="sm"
            data-full-width={false}
          >
            <Tabs.ListContainer>
              <Tabs.List aria-label="选项">
                <Tabs.Tab key="system" id="system">
                  自动
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab key="dark" id="dark">
                  深色
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab key="light" id="light">
                  浅色
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>
        </SettingItem>
        <SettingItem
          compatKey="legacy"
          title="主题"
          actions={
            <>
              <Button
                size="sm"
                isIconOnly
                onPress={async () => {
                  setFetching(true)
                  try {
                    await fetchThemes()
                    setCustomThemes(await resolveThemes())
                  } catch (e) {
                    notify(e, { variant: 'danger' })
                  } finally {
                    setFetching(false)
                  }
                }}
                variant="ghost"
                data-color="default"
                isPending={fetching}
                isDisabled={fetching}
              >
                {fetching ? (
                  <Spinner size="sm" color="current" />
                ) : (
                  <IoMdCloudDownload className="text-lg" />
                )}
              </Button>
              <Button
                size="sm"
                isIconOnly
                onPress={async () => {
                  const files = await getFilePath(['css'])
                  if (!files) return
                  try {
                    await importThemes(files)
                    setCustomThemes(await resolveThemes())
                  } catch (e) {
                    notify(e, { variant: 'danger' })
                  }
                }}
                variant="ghost"
                data-color="default"
              >
                <BiSolidFileImport className="text-lg" />
              </Button>
              <Button
                size="sm"
                isIconOnly
                onPress={async () => {
                  setOpenCSSEditor(true)
                }}
                variant="ghost"
                data-color="default"
              >
                <MdEditDocument className="text-lg" />
              </Button>
            </>
          }
        >
          {customThemes && (
            <Select
              aria-label="自定义主题"
              className={['w-[60%]'].filter(Boolean).join(' ')}
              data-size="sm"
              value={customTheme ?? null}
              onChange={async (v) => {
                try {
                  await patchAppConfig({ customTheme: v as string })
                } catch (e) {
                  notify(e, { variant: 'danger' })
                }
              }}
            >
              <Select.Trigger className="data-[hover=true]:bg-default-200">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
                <ListBox>
                  {customThemes.map((theme) => (
                    <ListBox.Item key={theme.key} id={theme.key} textValue={theme.label}>
                      {theme.label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </SettingItem>
      </SettingCard>
    </>
  )
}

export default AppearanceConfig
