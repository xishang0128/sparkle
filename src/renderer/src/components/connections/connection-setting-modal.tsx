import { Button, InputGroup, Modal, Switch } from '@heroui-v3/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { settingItemProps } from '../base/base-controls'
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
        <Modal.Container>
          <Modal.Dialog className="max-w-md flag-emoji">
            <Modal.Header>
              <Modal.Heading>连接设置</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="py-2 gap-1">
              <SettingItem title="显示应用图标" {...settingItemProps} divider>
                <Switch
                  aria-label="显示应用图标"
                  isSelected={displayIcon}
                  onChange={(v) => {
                    patchAppConfig({ displayIcon: v })
                  }}
                >
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
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
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
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
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ConnectionSettingModal
