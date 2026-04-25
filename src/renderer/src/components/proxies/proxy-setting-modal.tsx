import { Switch, Input, Select, SelectItem, Tab, Tabs } from '@heroui/react'
import { Modal } from '@heroui-v3/react'
import React, { useState, useEffect, useRef } from 'react'
import SettingItem from '../base/base-setting-item'
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
        <Modal.Container scroll="inside">
          <Modal.Dialog className="max-w-xl flag-emoji">
            <Modal.Header className="pb-0">
              <Modal.Heading>代理组设置</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[70vh] overflow-y-auto py-2 gap-1">
              <SettingItem compatKey="legacy" title="代理节点展示列数" divider>
                <Select
                  classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
                  className="w-37.5"
                  size="sm"
                  selectedKeys={new Set([proxyCols])}
                  disallowEmptySelection={true}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4'
                    })
                  }}
                >
                  <SelectItem key="auto">自动</SelectItem>
                  <SelectItem key="1">一列</SelectItem>
                  <SelectItem key="2">两列</SelectItem>
                  <SelectItem key="3">三列</SelectItem>
                  <SelectItem key="4">四列</SelectItem>
                </Select>
              </SettingItem>
              <SettingItem compatKey="legacy" title="节点排序方式" divider>
                <Tabs
                  size="sm"
                  color="primary"
                  selectedKey={proxyDisplayOrder}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      proxyDisplayOrder: v as 'default' | 'delay' | 'name'
                    })
                  }}
                >
                  <Tab key="default" title="默认" />
                  <Tab key="delay" title="延迟" />
                  <Tab key="name" title="名称" />
                </Tabs>
              </SettingItem>
              <SettingItem compatKey="legacy" title="代理组详细信息" divider>
                <Tabs
                  size="sm"
                  color="primary"
                  selectedKey={groupDisplayLayout}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      groupDisplayLayout: v as 'hidden' | 'single' | 'double'
                    })
                  }}
                >
                  <Tab key="hidden" title="隐藏" />
                  <Tab key="single" title="单行" />
                  <Tab key="double" title="双行" />
                </Tabs>
              </SettingItem>
              <SettingItem compatKey="legacy" title="代理节点详细信息" divider>
                <Tabs
                  size="sm"
                  color="primary"
                  selectedKey={proxyDisplayLayout}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      proxyDisplayLayout: v as 'hidden' | 'single' | 'double'
                    })
                  }}
                >
                  <Tab key="hidden" title="隐藏" />
                  <Tab key="single" title="单行" />
                  <Tab key="double" title="双行" />
                </Tabs>
              </SettingItem>
              <SettingItem compatKey="legacy" title="切换节点时断开连接" divider>
                <Switch
                  size="sm"
                  isSelected={autoCloseConnection}
                  onValueChange={(v) => {
                    patchAppConfig({ autoCloseConnection: v })
                  }}
                />
              </SettingItem>
              {autoCloseConnection && (
                <SettingItem compatKey="legacy" title="打断模式" divider>
                  <Tabs
                    size="sm"
                    color="primary"
                    selectedKey={closeMode}
                    onSelectionChange={async (v) => {
                      await patchAppConfig({
                        closeMode: v as 'all' | 'group'
                      })
                    }}
                  >
                    <Tab key="all" title="所有连接" />
                    <Tab key="group" title="仅当前组" />
                  </Tabs>
                </SettingItem>
              )}
              <SettingItem compatKey="legacy" title="延迟测试地址" divider>
                <Input
                  size="sm"
                  className="w-[60%]"
                  value={url}
                  placeholder="默认 https://www.gstatic.com/generate_204"
                  onValueChange={(v) => {
                    setUrl(v)
                    setUrlDebounce(v)
                  }}
                />
              </SettingItem>
              <SettingItem compatKey="legacy" title="测试地址来源" divider>
                <Tabs
                  size="sm"
                  color="primary"
                  selectedKey={delayTestUrlScope}
                  onSelectionChange={async (v) => {
                    await patchAppConfig({
                      delayTestUrlScope: v as 'group' | 'global'
                    })
                  }}
                >
                  <Tab key="group" title="使用组配置" />
                  <Tab key="global" title="使用统一地址" />
                </Tabs>
              </SettingItem>
              <SettingItem compatKey="legacy" title="使用策略组 API 测速" divider>
                <Switch
                  size="sm"
                  isSelected={delayTestUseGroupApi}
                  onValueChange={(v) => {
                    patchAppConfig({ delayTestUseGroupApi: v })
                  }}
                />
              </SettingItem>
              {!delayTestUseGroupApi && (
                <SettingItem compatKey="legacy" title="延迟测试并发数量" divider>
                  <Input
                    type="number"
                    size="sm"
                    className="w-25"
                    value={delayTestConcurrency?.toString()}
                    min={MIN_DELAY_TEST_CONCURRENCY}
                    max={MAX_DELAY_TEST_CONCURRENCY}
                    placeholder={`默认 ${DEFAULT_DELAY_TEST_CONCURRENCY}`}
                    onValueChange={(v) => {
                      patchAppConfig({
                        delayTestConcurrency: normalizeDelayTestConcurrency(parseInt(v))
                      })
                    }}
                  />
                </SettingItem>
              )}
              <SettingItem compatKey="legacy" title="延迟测试超时时间">
                <Input
                  type="number"
                  size="sm"
                  className="w-25"
                  value={delayTestTimeout?.toString()}
                  placeholder="默认 5000"
                  onValueChange={(v) => {
                    patchAppConfig({ delayTestTimeout: parseInt(v) })
                  }}
                />
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
