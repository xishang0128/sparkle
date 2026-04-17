import { Button, Switch } from '@heroui/react'
import { Modal } from '@heroui-v3/react'
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
  useAppConfig()
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
    <Modal>
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
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={handleClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="mt-4 h-[calc(100%-32px)] max-w-none w-[calc(100%-100px)]">
            <Modal.Header className="app-drag pb-0">
              <div className="flex justify-start">
                <Modal.Heading className="flex items-center">编辑订阅</Modal.Heading>
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
            </Modal.Header>
            <Modal.Body className="h-full">
              <BaseEditor
                language="yaml"
                value={currData}
                originalValue={isDiff ? originalData : undefined}
                onChange={(value) => setCurrData(value)}
                diffRenderSideBySide={sideBySide}
              />
            </Modal.Body>
            <Modal.Footer className="flex justify-between pt-0 pb-0">
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
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default EditFileModal
