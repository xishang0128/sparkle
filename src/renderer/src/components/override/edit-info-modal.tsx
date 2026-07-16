import {
  Button,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  Surface,
  Switch
} from '@heroui-v3/react'
import type { ReactNode } from 'react'
import React, { useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'

interface Props {
  item: OverrideItem
  updateOverrideItem: (item: OverrideItem) => Promise<void>
  onClose: () => void
}

const EditInfoModal: React.FC<Props> = (props) => {
  const { item, updateOverrideItem, onClose } = props
  useAppConfig()
  const [values, setValues] = useState(item)

  const onSave = async (): Promise<void> => {
    try {
      const itemToSave = {
        ...values
      }

      await updateOverrideItem(itemToSave)
      if (item.id) {
        await restartCore()
      }
      onClose()
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  const renderField = (
    title: string,
    content: ReactNode,
    options?: {
      actions?: ReactNode
      align?: 'start' | 'center'
      divider?: boolean
    }
  ) => {
    const { actions, align = 'center', divider = true } = options || {}

    return (
      <Surface key={title} variant="transparent" className="flex flex-col">
        <div
          className={`setting-item px-0 setting-item--content-end ${
            align === 'start' ? 'setting-item--start' : 'setting-item--center'
          }`}
          style={{ gridTemplateColumns: '88px minmax(0, 1fr)' }}
        >
          <div className="setting-item__title-wrap">
            <Label className="setting-item__title">{title}</Label>
            {actions}
          </div>
          <div className="setting-item__content">{content}</div>
        </div>
        {divider ? <Separator variant="tertiary" className="bg-default-100/70" /> : null}
      </Surface>
    )
  }

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[min(500px,calc(100%-24px))] max-w-none">
            <Modal.Header className="app-drag pb-1">
              <Modal.Heading>{item.id ? '编辑覆写信息' : '导入远程覆写'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[70vh] overflow-y-auto pt-1 pb-2">
              <Surface variant="transparent" className="flex flex-col">
                {renderField(
                  '名称',
                  <Input
                    aria-label="名称"
                    data-setting-input="edit-modal-name"
                    value={values.name}
                    variant="secondary"
                    onChange={(event) => {
                      setValues({ ...values, name: event.target.value })
                    }}
                  />
                )}
                {values.type === 'remote' &&
                  renderField(
                    '覆写地址',
                    <Input
                      aria-label="覆写地址"
                      data-setting-input="edit-modal"
                      value={values.url || ''}
                      variant="secondary"
                      onChange={(event) => {
                        setValues({ ...values, url: event.target.value })
                      }}
                    />,
                    { align: 'start' }
                  )}
                {values.type === 'remote' &&
                  renderField(
                    '证书指纹',
                    <Input
                      aria-label="证书指纹"
                      data-setting-input="edit-modal"
                      value={values.fingerprint ?? ''}
                      variant="secondary"
                      onChange={(event) => {
                        const v = event.target.value
                        setValues({ ...values, fingerprint: v.trim() || undefined })
                      }}
                    />
                  )}
                {renderField(
                  '文件类型',
                  <Select
                    aria-label="文件类型"
                    value={values.ext}
                    variant="secondary"
                    onChange={(value) => {
                      if (Array.isArray(value) || value == null) return
                      setValues({ ...values, ext: value as 'js' | 'yaml' })
                    }}
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        <ListBox.Item id="yaml" textValue="YAML">
                          YAML
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                        <ListBox.Item id="js" textValue="JavaScript">
                          JavaScript
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      </ListBox>
                    </Select.Popover>
                  </Select>
                )}
                {renderField(
                  '全局覆写',
                  <Switch
                    aria-label="全局覆写"
                    size="sm"
                    isSelected={values.global ?? false}
                    onChange={(v) => {
                      setValues({ ...values, global: v })
                    }}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>,
                  { divider: false }
                )}
              </Surface>
            </Modal.Body>
            <Modal.Footer className="justify-end pt-2">
              <Button size="sm" variant="secondary" onPress={onClose}>
                取消
              </Button>
              <Button size="sm" variant="primary" onPress={onSave}>
                {item.id ? '保存' : '导入'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default EditInfoModal
