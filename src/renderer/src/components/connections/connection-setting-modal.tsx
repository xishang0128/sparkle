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
import React, { useState } from 'react'
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
  const [intervalInput, setIntervalInput] = useState(connectionInterval)

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
            <div className="flex">
              {intervalInput !== connectionInterval && (
                <Button
                  size="sm"
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    const actualValue = intervalInput < 100 ? 100 : intervalInput
                    setIntervalInput(actualValue)
                    patchAppConfig({ connectionInterval: actualValue })
                    restartMihomoConnections()
                  }}
                >
                  确认
                </Button>
              )}
              <Input
                size="sm"
                type="number"
                className="w-[150px]"
                endContent="ms"
                value={intervalInput.toString()}
                max={65535}
                min={0}
                onValueChange={(v) => {
                  setIntervalInput(parseInt(v) || 0)
                }}
              />
            </div>
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
