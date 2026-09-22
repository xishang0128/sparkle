import { Input, Button, Switch } from '@heroui/react'

import React, { useState, useEffect } from 'react'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import {
  startSubStoreFrontendServer,
  startSubStoreBackendServer,
  stopSubStoreFrontendServer,
  stopSubStoreBackendServer
} from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import debounce from '@renderer/utils/debounce'
import { isValidCron } from 'cron-validator'
import { notify } from '@renderer/utils/notification'

const SubStoreConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    useSubStore = true,
    useCustomSubStore = false,
    useProxyInSubStore = false,
    subStoreHost = '127.0.0.1',
    customSubStoreUrl,
    subStoreBackendSyncCron,
    subStoreBackendDownloadCron,
    subStoreBackendUploadCron
  } = appConfig || {}

  const [customSubStoreUrlValue, setCustomSubStoreUrlValue] = useState(customSubStoreUrl ?? '')
  const setCustomSubStoreUrl = debounce(async (v: string) => {
    await patchAppConfig({ customSubStoreUrl: v })
  }, 500)
  const [subStoreBackendSyncCronValue, setSubStoreBackendSyncCronValue] = useState(
    subStoreBackendSyncCron ?? ''
  )
  const [subStoreBackendDownloadCronValue, setSubStoreBackendDownloadCronValue] = useState(
    subStoreBackendDownloadCron ?? ''
  )
  const [subStoreBackendUploadCronValue, setSubStoreBackendUploadCronValue] = useState(
    subStoreBackendUploadCron ?? ''
  )

  useEffect(() => {
    setCustomSubStoreUrlValue(customSubStoreUrl ?? '')
  }, [customSubStoreUrl])

  useEffect(() => {
    setSubStoreBackendSyncCronValue(subStoreBackendSyncCron ?? '')
  }, [subStoreBackendSyncCron])

  useEffect(() => {
    setSubStoreBackendDownloadCronValue(subStoreBackendDownloadCron ?? '')
  }, [subStoreBackendDownloadCron])

  useEffect(() => {
    setSubStoreBackendUploadCronValue(subStoreBackendUploadCron ?? '')
  }, [subStoreBackendUploadCron])

  return (
    <SettingCard header="Sub-Store 设置">
      <SettingItem compatKey="legacy" title="启用 Sub-Store" divider={useSubStore}>
        <Switch
          size="sm"
          isSelected={useSubStore}
          onChange={async (v) => {
            try {
              await patchAppConfig({ useSubStore: v })
              if (v) {
                await startSubStoreFrontendServer()
                await startSubStoreBackendServer()
              } else {
                await stopSubStoreFrontendServer()
                await stopSubStoreBackendServer()
              }
            } catch (e) {
              notify(e, { variant: 'danger' })
            }
          }}
          aria-label="启用 Sub-Store"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      {useSubStore && (
        <>
          <SettingItem compatKey="legacy" title="允许局域网连接" divider>
            <Switch
              size="sm"
              isSelected={subStoreHost === '0.0.0.0'}
              onChange={async (v) => {
                try {
                  if (v) {
                    await patchAppConfig({ subStoreHost: '0.0.0.0' })
                  } else {
                    await patchAppConfig({ subStoreHost: '127.0.0.1' })
                  }
                  await startSubStoreFrontendServer()
                  await startSubStoreBackendServer()
                } catch (e) {
                  notify(e, { variant: 'danger' })
                }
              }}
              aria-label="允许局域网连接"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
          <SettingItem compatKey="legacy" title="使用自建 Sub-Store 后端" divider>
            <Switch
              size="sm"
              isSelected={useCustomSubStore}
              onChange={async (v) => {
                try {
                  await patchAppConfig({ useCustomSubStore: v })
                  if (v) {
                    await stopSubStoreBackendServer()
                  } else {
                    await startSubStoreBackendServer()
                  }
                } catch (e) {
                  notify(e, { variant: 'danger' })
                }
              }}
              aria-label="使用自建 Sub-Store 后端"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
          {useCustomSubStore ? (
            <SettingItem compatKey="legacy" title="自建 Sub-Store 后端地址">
              <Input
                value={customSubStoreUrlValue}
                placeholder="必须包含协议头"
                onChange={(event) => {
                  const v = event.target.value
                  setCustomSubStoreUrlValue(v)
                  setCustomSubStoreUrl(v)
                }}
                className="w-[60%]"
                fullWidth
              />
            </SettingItem>
          ) : (
            <>
              <SettingItem compatKey="legacy" title="为 Sub-Store 内所有请求启用代理" divider>
                <Switch
                  size="sm"
                  isSelected={useProxyInSubStore}
                  onChange={async (v) => {
                    try {
                      await patchAppConfig({ useProxyInSubStore: v })
                      await startSubStoreBackendServer()
                    } catch (e) {
                      notify(e, { variant: 'danger' })
                    }
                  }}
                  aria-label="为 Sub-Store 内所有请求启用代理"
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </SettingItem>
              <SettingItem compatKey="legacy" title="定时同步订阅/文件" divider>
                <div className="flex w-[60%] gap-2">
                  {subStoreBackendSyncCronValue !== subStoreBackendSyncCron && (
                    <Button
                      size="sm"
                      onPress={async () => {
                        if (
                          !subStoreBackendSyncCronValue ||
                          isValidCron(subStoreBackendSyncCronValue)
                        ) {
                          await patchAppConfig({
                            subStoreBackendSyncCron: subStoreBackendSyncCronValue
                          })
                          notify('重启应用生效')
                        } else {
                          notify('Cron 表达式无效', { variant: 'danger' })
                        }
                      }}
                      variant="primary"
                      data-color="primary"
                    >
                      确认
                    </Button>
                  )}
                  <Input
                    value={subStoreBackendSyncCronValue}
                    placeholder="Cron 表达式"
                    onChange={(event) => {
                      const v = event.target.value
                      setSubStoreBackendSyncCronValue(v)
                    }}
                    fullWidth
                  />
                </div>
              </SettingItem>
              <SettingItem compatKey="legacy" title="定时恢复配置" divider>
                <div className="flex w-[60%] gap-2">
                  {subStoreBackendDownloadCronValue !== subStoreBackendDownloadCron && (
                    <Button
                      size="sm"
                      onPress={async () => {
                        if (
                          !subStoreBackendDownloadCronValue ||
                          isValidCron(subStoreBackendDownloadCronValue)
                        ) {
                          await patchAppConfig({
                            subStoreBackendDownloadCron: subStoreBackendDownloadCronValue
                          })
                          notify('重启应用生效')
                        } else {
                          notify('Cron 表达式无效', { variant: 'danger' })
                        }
                      }}
                      variant="primary"
                      data-color="primary"
                    >
                      确认
                    </Button>
                  )}
                  <Input
                    value={subStoreBackendDownloadCronValue}
                    placeholder="Cron 表达式"
                    onChange={(event) => {
                      const v = event.target.value
                      setSubStoreBackendDownloadCronValue(v)
                    }}
                    fullWidth
                  />
                </div>
              </SettingItem>
              <SettingItem compatKey="legacy" title="定时备份配置">
                <div className="flex w-[60%] gap-2">
                  {subStoreBackendUploadCronValue !== subStoreBackendUploadCron && (
                    <Button
                      size="sm"
                      onPress={async () => {
                        if (
                          !subStoreBackendUploadCronValue ||
                          isValidCron(subStoreBackendUploadCronValue)
                        ) {
                          await patchAppConfig({
                            subStoreBackendUploadCron: subStoreBackendUploadCronValue
                          })
                          notify('重启应用生效')
                        } else {
                          notify('Cron 表达式无效', { variant: 'danger' })
                        }
                      }}
                      variant="primary"
                      data-color="primary"
                    >
                      确认
                    </Button>
                  )}
                  <Input
                    value={subStoreBackendUploadCronValue}
                    placeholder="Cron 表达式"
                    onChange={(event) => {
                      const v = event.target.value
                      setSubStoreBackendUploadCronValue(v)
                    }}
                    fullWidth
                  />
                </div>
              </SettingItem>
            </>
          )}
        </>
      )}
    </SettingCard>
  )
}

export default SubStoreConfig
