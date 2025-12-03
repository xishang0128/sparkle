import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalFooter,
  Button,
  Switch,
  ModalBody,
  Input
} from '@heroui/react'
import React from 'react'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartMihomoConnections } from '@renderer/utils/ipc'

interface Props {
  onClose: () => void
}

const ConnectionSettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { appConfig, patchAppConfig } = useAppConfig()

  const { displayIcon = true, displayAppName = true, connectionInterval = 500 } = appConfig || {}

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="md"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="flag-emoji">
        <ModalHeader className="flex">连接设置</ModalHeader>
        <ModalBody className="py-2 gap-1">
          <SettingItem title="显示应用图标" divider>
            <Switch
              size="sm"
              isSelected={displayIcon}
              onValueChange={(v) => {
                patchAppConfig({ displayIcon: v })
              }}
            />
          </SettingItem>
          <SettingItem title="显示应用名称" divider>
            <Switch
              size="sm"
              isSelected={displayAppName}
              onValueChange={(v) => {
                patchAppConfig({ displayAppName: v })
              }}
            />
          </SettingItem>
          <SettingItem title="刷新间隔">
            <Input
              type="number"
              size="sm"
              className="w-[150px]"
              endContent="ms"
              value={connectionInterval?.toString()}
              placeholder="默认 500"
              onValueChange={async (v) => {
                let num = parseInt(v)
                if (isNaN(num)) num = 500
                if (num < 100) num = 100
                await patchAppConfig({ connectionInterval: num })
                await restartMihomoConnections()
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

export default ConnectionSettingModal
