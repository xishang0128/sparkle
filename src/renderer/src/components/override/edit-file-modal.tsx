import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getOverride, restartCore, setOverride } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import ConfirmModal from '../base/base-confirm'

interface Props {
  id: string
  language: 'javascript' | 'yaml'
  onClose: () => void
}

const EditFileModal: React.FC<Props> = (props) => {
  const { id, language, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')
  const [originalData, setOriginalData] = useState('')
  const [isDiff, setIsDiff] = useState(false)
  const [sideBySide, setSideBySide] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const isModified = currData !== originalData

  const handleClose = (): void => {
    if (isModified) {
      setIsConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const getContent = async (): Promise<void> => {
    const data = await getOverride(id, language === 'javascript' ? 'js' : 'yaml')
    setCurrData(data)
    setOriginalData(data)
  }

  useEffect(() => {
    getContent()
  }, [])

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      classNames={{
        base: 'max-w-none w-full',
        backdrop: 'top-[48px]'
      }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={handleClose}
      scrollBehavior="inside"
    >
      {isConfirmOpen && (
        <ConfirmModal
          title="确认取消"
          description="您有未保存的修改，确定要取消吗？"
          confirmText="放弃修改"
          cancelText="继续编辑"
          onChange={setIsConfirmOpen}
          onConfirm={onClose}
        />
      )}
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">
          编辑覆写{language === 'javascript' ? '脚本' : '配置'}
        </ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language={language}
            value={currData}
            originalValue={isDiff ? originalData : undefined}
            onChange={(value) => setCurrData(value)}
            diffRenderSideBySide={sideBySide}
          />
        </ModalBody>
        <ModalFooter className="pt-0 flex justify-between">
          <div className="flex items-center space-x-2">
            <Switch size="sm" isSelected={isDiff} onValueChange={setIsDiff}>
              显示修改
            </Switch>
            <Switch size="sm" isSelected={sideBySide} onValueChange={setSideBySide}>
              侧边显示
            </Switch>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="light" onPress={handleClose}>
              取消
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={async () => {
                try {
                  await setOverride(id, language === 'javascript' ? 'js' : 'yaml', currData)
                  await restartCore()
                  onClose()
                } catch (e) {
                  alert(e)
                }
              }}
            >
              保存
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditFileModal
