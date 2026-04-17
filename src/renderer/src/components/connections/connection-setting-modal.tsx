import { Button, Switch, Input } from '@heroui/react'
import { Modal } from '@heroui-v3/react'
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
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="max-w-md flag-emoji">
            <Modal.Header>
              <Modal.Heading>连接设置</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="py-2 gap-1">
              <SettingItem compatKey="legacy" title="显示应用图标" divider>
                <Switch
                  size="sm"
                  isSelected={displayIcon}
                  onValueChange={(v) => {
                    patchAppConfig({ displayIcon: v })
                  }}
                />
              </SettingItem>
              <SettingItem compatKey="legacy" title="显示应用名称" divider>
                <Switch
                  size="sm"
                  isSelected={displayAppName}
                  onValueChange={(v) => {
                    patchAppConfig({ displayAppName: v })
                  }}
                />
              </SettingItem>
              <SettingItem compatKey="legacy" title="刷新间隔">
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
                    className="w-37.5"
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
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ConnectionSettingModal
