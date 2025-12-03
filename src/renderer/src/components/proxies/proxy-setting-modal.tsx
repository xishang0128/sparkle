import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Input,
  Select,
  SelectItem,
  Tab,
  Tabs
} from '@heroui/react'
import React, { useState, useEffect } from 'react'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import debounce from '@renderer/utils/debounce'

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
    delayTestUrl,
    delayTestConcurrency,
    delayTestTimeout
  } = appConfig || {}

  const [url, setUrl] = useState(delayTestUrl ?? '')

  const setUrlDebounce = debounce((v: string) => {
    patchAppConfig({ delayTestUrl: v })
  }, 500)

  useEffect(() => {
    setUrl(delayTestUrl ?? '')
  }, [delayTestUrl])

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="flag-emoji">
        <ModalHeader className="flex pb-0">代理组设置</ModalHeader>
        <ModalBody className="py-2 gap-1">
          <SettingItem title="代理节点展示列数" divider>
            <Select
              classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
              className="w-[150px]"
              size="sm"
              selectedKeys={new Set([proxyCols])}
              disallowEmptySelection={true}
              onSelectionChange={async (v) => {
                await patchAppConfig({ proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4' })
              }}
            >
              <SelectItem key="auto">自动</SelectItem>
              <SelectItem key="1">一列</SelectItem>
              <SelectItem key="2">两列</SelectItem>
              <SelectItem key="3">三列</SelectItem>
              <SelectItem key="4">四列</SelectItem>
            </Select>
          </SettingItem>
          <SettingItem title="节点排序方式" divider>
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
          <SettingItem title="代理组详细信息" divider>
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
          <SettingItem title="代理节点详细信息" divider>
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
          <SettingItem title="切换节点时断开连接" divider>
            <Switch
              size="sm"
              isSelected={autoCloseConnection}
              onValueChange={(v) => {
                patchAppConfig({ autoCloseConnection: v })
              }}
            />
          </SettingItem>
          <SettingItem title="延迟测试地址" divider>
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
          <SettingItem title="延迟测试并发数量" divider>
            <Input
              type="number"
              size="sm"
              className="w-[100px]"
              value={delayTestConcurrency?.toString()}
              placeholder="默认 50"
              onValueChange={(v) => {
                patchAppConfig({ delayTestConcurrency: parseInt(v) })
              }}
            />
          </SettingItem>
          <SettingItem title="延迟测试超时时间">
            <Input
              type="number"
              size="sm"
              className="w-[100px]"
              value={delayTestTimeout?.toString()}
              placeholder="默认 5000"
              onValueChange={(v) => {
                patchAppConfig({ delayTestTimeout: parseInt(v) })
              }}
            />
          </SettingItem>
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ProxySettingModal
