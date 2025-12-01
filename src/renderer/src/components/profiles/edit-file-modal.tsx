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
import { getProfileStr, setProfileStr } from '@renderer/utils/ipc'
import { useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import ConfirmModal from '../base/base-confirm'

interface Props {
  id: string
  isRemote: boolean
  onClose: () => void
}

const EditFileModal: React.FC<Props> = (props) => {
  const { id, isRemote, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')
  const [originalData, setOriginalData] = useState('')
  const [isDiff, setIsDiff] = useState(false)
  const [sideBySide, setSideBySide] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const navigate = useNavigate()

  const isModified = currData !== originalData

  const handleClose = (): void => {
    if (isModified) {
      setIsConfirmOpen(true)
    } else {
      onClose()
    }
  }

  const getContent = async (): Promise<void> => {
    const data = await getProfileStr(id)
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
          <div className="flex justify-start">
            <div className="flex items-center">编辑订阅</div>
            {isRemote && (
              <small className="ml-2 text-foreground-500">
                注意：此处编辑配置更新订阅后会还原，如需要自定义配置请使用
                <Button
                  size="sm"
                  color="primary"
                  variant="light"
                  className="app-nodrag"
                  onPress={() => {
                    navigate('/override')
                  }}
                >
                  覆写
                </Button>
                功能
              </small>
            )}
          </div>
        </ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language="yaml"
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
                await setProfileStr(id, currData)
                onClose()
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
