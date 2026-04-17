import { cn, Button, Input, Switch, Select, SelectItem } from '@heroui/react'
import { Modal } from '@heroui-v3/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
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
  const inputWidth = 'w-[400px] md:w-[400px] lg:w-[600px] xl:w-[800px]'

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

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[600px] md:w-[600px] lg:w-[800px] xl:w-[1024px]">
            <Modal.Header className="app-drag">
              <Modal.Heading>{item.id ? '编辑覆写信息' : '导入远程覆写'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <SettingItem compatKey="legacy" title="名称">
                <Input
                  size="sm"
                  className={cn(inputWidth)}
                  value={values.name}
                  onValueChange={(v) => {
                    setValues({ ...values, name: v })
                  }}
                />
              </SettingItem>
              {values.type === 'remote' && (
                <>
                  <SettingItem compatKey="legacy" title="覆写地址">
                    <Input
                      size="sm"
                      className={cn(inputWidth)}
                      value={values.url || ''}
                      onValueChange={(v) => {
                        setValues({ ...values, url: v })
                      }}
                    />
                  </SettingItem>
                  <SettingItem compatKey="legacy" title="证书指纹">
                    <Input
                      size="sm"
                      className={cn(inputWidth)}
                      value={values.fingerprint ?? ''}
                      onValueChange={(v) => {
                        setValues({ ...values, fingerprint: v.trim() || undefined })
                      }}
                    />
                  </SettingItem>
                </>
              )}
              <SettingItem compatKey="legacy" title="文件类型">
                <Select
                  size="sm"
                  className={cn(inputWidth)}
                  selectedKeys={[values.ext]}
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys)[0] as 'js' | 'yaml'
                    setValues({ ...values, ext: key })
                  }}
                >
                  <SelectItem key="yaml">YAML</SelectItem>
                  <SelectItem key="js">JavaScript</SelectItem>
                </Select>
              </SettingItem>
              <SettingItem compatKey="legacy" title="全局覆写">
                <Switch
                  size="sm"
                  isSelected={values.global ?? false}
                  onValueChange={(v) => {
                    setValues({ ...values, global: v })
                  }}
                />
              </SettingItem>
            </Modal.Body>
            <Modal.Footer>
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
