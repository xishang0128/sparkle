import { cn, Button, Input, Switch, Select, SelectItem } from '@heroui/react'
import { Label, Modal, Separator, Surface } from '@heroui-v3/react'
import type { ReactNode } from 'react'
import React, { useState } from 'react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { restartCore } from '@renderer/utils/ipc'

interface Props {
  item: OverrideItem
  updateOverrideItem: (item: OverrideItem) => Promise<void>
  onClose: () => void
}

const EditInfoModal: React.FC<Props> = (props) => {
  const { item, updateOverrideItem, onClose } = props
  useAppConfig()
  const [values, setValues] = useState(item)
  const fieldWidth = 'w-full'

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
      alert(e)
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
        <Surface
          variant="transparent"
          className={cn(
            'grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 py-2',
            align === 'start' ? 'items-start' : 'items-center'
          )}
        >
          <Surface variant="transparent" className="flex min-h-9 items-center gap-2">
            <Label className="text-sm leading-6 text-foreground-500">{title}</Label>
            {actions}
          </Surface>
          <Surface variant="transparent" className="flex min-w-0 justify-end">
            {content}
          </Surface>
        </Surface>
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
                    size="sm"
                    className={cn(fieldWidth)}
                    value={values.name}
                    onValueChange={(v) => {
                      setValues({ ...values, name: v })
                    }}
                  />
                )}
                {values.type === 'remote' &&
                  renderField(
                    '覆写地址',
                    <Input
                      size="sm"
                      className={cn(fieldWidth)}
                      value={values.url || ''}
                      onValueChange={(v) => {
                        setValues({ ...values, url: v })
                      }}
                    />,
                    { align: 'start' }
                  )}
                {values.type === 'remote' &&
                  renderField(
                    '证书指纹',
                    <Input
                      size="sm"
                      className={cn(fieldWidth)}
                      value={values.fingerprint ?? ''}
                      onValueChange={(v) => {
                        setValues({ ...values, fingerprint: v.trim() || undefined })
                      }}
                    />
                  )}
                {renderField(
                  '文件类型',
                  <Select
                    size="sm"
                    className={cn(fieldWidth)}
                    selectedKeys={[values.ext]}
                    onSelectionChange={(keys) => {
                      const key = Array.from(keys)[0] as 'js' | 'yaml' | undefined
                      if (!key) return
                      setValues({ ...values, ext: key })
                    }}
                  >
                    <SelectItem key="yaml">YAML</SelectItem>
                    <SelectItem key="js">JavaScript</SelectItem>
                  </Select>
                )}
                {renderField(
                  '全局覆写',
                  <Switch
                    size="sm"
                    isSelected={values.global ?? false}
                    onValueChange={(v) => {
                      setValues({ ...values, global: v })
                    }}
                  />,
                  { divider: false }
                )}
              </Surface>
            </Modal.Body>
            <Modal.Footer className="justify-end pt-2">
              <Button size="sm" variant="light" onPress={onClose}>
                取消
              </Button>
              <Button size="sm" color="primary" onPress={onSave}>
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
