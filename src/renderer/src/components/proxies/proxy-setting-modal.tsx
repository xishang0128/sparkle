import { Input, InputGroup, ListBox, Modal, Select, Switch } from '@heroui-v3/react'
import React, { useState, useEffect, useRef } from 'react'
import SettingItem from '../base/base-setting-item'
import { SettingTabs, settingItemProps } from '../base/base-controls'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import debounce from '@renderer/utils/debounce'
import {
  DEFAULT_DELAY_TEST_CONCURRENCY,
  MAX_DELAY_TEST_CONCURRENCY,
  MIN_DELAY_TEST_CONCURRENCY,
  normalizeDelayTestConcurrency
} from '@renderer/utils/delay-test'

interface Props {
  onClose: () => void
}

const ProxySettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    proxyCols = 'auto',
    proxyDisplayOrder = 'default',
    groupDisplayLayout = 'single',
    proxyDisplayLayout = 'double',
    showGroupSelectedProxy = true,
    autoCloseConnection = true,
    closeMode = 'all',
    delayTestUrl,
    delayTestUrlScope = 'group',
    delayTestUseGroupApi = false,
    delayTestConcurrency,
    delayTestTimeout
  } = appConfig || {}

  const [url, setUrl] = useState(delayTestUrl ?? '')

  const setUrlDebounce = useRef(
    debounce((v: string) => {
      patchAppConfig({ delayTestUrl: v })
    }, 500)
  ).current

  useEffect(() => {
    setUrl(delayTestUrl ?? '')
  }, [delayTestUrl])

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container>
          <Modal.Dialog className="max-w-xl flag-emoji">
            <Modal.Header className="pb-0">
              <Modal.Heading>代理组设置</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[70vh] overflow-y-auto py-2 gap-1">
              <SettingItem title="代理节点展示列数" {...settingItemProps} divider>
                <Select
                  aria-label="代理节点展示列数"
                  value={proxyCols}
                  variant="secondary"
                  onChange={async (value) => {
                    if (Array.isArray(value) || value == null) return
                    if (value === proxyCols) return

                    await patchAppConfig({
                      proxyCols: value as 'auto' | '1' | '2' | '3' | '4'
                    })
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="auto" textValue="自动">
                        自动
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="1" textValue="一列">
                        一列
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="2" textValue="两列">
                        两列
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="3" textValue="三列">
                        三列
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="4" textValue="四列">
                        四列
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </SettingItem>
              <SettingItem title="节点排序方式" {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel="节点排序方式"
                  selectedKey={proxyDisplayOrder}
                  options={[
                    { id: 'default', label: '默认' },
                    { id: 'delay', label: '延迟' },
                    { id: 'name', label: '名称' }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      proxyDisplayOrder: v as 'default' | 'delay' | 'name'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title="代理组详细信息" {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel="代理组详细信息"
                  selectedKey={groupDisplayLayout}
                  options={[
                    { id: 'hidden', label: '隐藏' },
                    { id: 'single', label: '单行' },
                    { id: 'double', label: '双行' }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      groupDisplayLayout: v as 'hidden' | 'single' | 'double'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title="代理节点详细信息" {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel="代理节点详细信息"
                  selectedKey={proxyDisplayLayout}
                  options={[
                    { id: 'hidden', label: '隐藏' },
                    { id: 'single', label: '单行' },
                    { id: 'double', label: '双行' }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      proxyDisplayLayout: v as 'hidden' | 'single' | 'double'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title="显示二级分组选中节点" {...settingItemProps} divider>
                <Switch
                  aria-label="显示二级分组选中节点"
                  isSelected={showGroupSelectedProxy}
                  onChange={(v) => {
                    patchAppConfig({ showGroupSelectedProxy: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              <SettingItem title="切换节点时断开连接" {...settingItemProps} divider>
                <Switch
                  aria-label="切换节点时断开连接"
                  isSelected={autoCloseConnection}
                  onChange={(v) => {
                    patchAppConfig({ autoCloseConnection: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              {autoCloseConnection && (
                <SettingItem title="打断模式" {...settingItemProps} divider>
                  <SettingTabs
                    ariaLabel="打断模式"
                    selectedKey={closeMode}
                    options={[
                      { id: 'all', label: '所有连接' },
                      { id: 'group', label: '仅当前组' }
                    ]}
                    onChange={async (v) => {
                      await patchAppConfig({
                        closeMode: v as 'all' | 'group'
                      })
                    }}
                  />
                </SettingItem>
              )}
              <SettingItem title="延迟测试地址" {...settingItemProps} divider>
                <Input
                  aria-label="延迟测试地址"
                  data-setting-input="url"
                  value={url}
                  placeholder="默认 https://www.gstatic.com/generate_204"
                  variant="secondary"
                  onChange={(event) => {
                    const v = event.target.value
                    setUrl(v)
                    setUrlDebounce(v)
                  }}
                />
              </SettingItem>
              <SettingItem title="测试地址来源" {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel="测试地址来源"
                  selectedKey={delayTestUrlScope}
                  options={[
                    { id: 'group', label: '使用组配置' },
                    { id: 'global', label: '使用统一地址' }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      delayTestUrlScope: v as 'group' | 'global'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem title="使用策略组 API 测速" {...settingItemProps} divider>
                <Switch
                  aria-label="使用策略组 API 测速"
                  isSelected={delayTestUseGroupApi}
                  onChange={(v) => {
                    patchAppConfig({ delayTestUseGroupApi: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              {!delayTestUseGroupApi && (
                <SettingItem title="延迟测试并发数量" {...settingItemProps} divider>
                  <InputGroup data-setting-input="number" variant="secondary">
                    <InputGroup.Input
                      aria-label="延迟测试并发数量"
                      type="number"
                      value={delayTestConcurrency?.toString()}
                      min={MIN_DELAY_TEST_CONCURRENCY}
                      max={MAX_DELAY_TEST_CONCURRENCY}
                      placeholder={`默认 ${DEFAULT_DELAY_TEST_CONCURRENCY}`}
                      onChange={(event) => {
                        const v = event.target.value
                        patchAppConfig({
                          delayTestConcurrency: normalizeDelayTestConcurrency(parseInt(v))
                        })
                      }}
                    />
                  </InputGroup>
                </SettingItem>
              )}
              <SettingItem title="延迟测试超时时间" {...settingItemProps}>
                <InputGroup data-setting-input="number" variant="secondary">
                  <InputGroup.Input
                    aria-label="延迟测试超时时间"
                    type="number"
                    value={delayTestTimeout?.toString()}
                    placeholder="默认 5000"
                    onChange={(event) => {
                      const v = event.target.value
                      patchAppConfig({ delayTestTimeout: parseInt(v) })
                    }}
                  />
                  <InputGroup.Suffix>ms</InputGroup.Suffix>
                </InputGroup>
              </SettingItem>
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ProxySettingModal
