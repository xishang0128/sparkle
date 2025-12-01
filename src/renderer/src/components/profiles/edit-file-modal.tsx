import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getProfileStr, setProfileStr } from '@renderer/utils/ipc'
import { useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  id: string
  isRemote: boolean
  onClose: () => void
}

const EditFileModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
  const [currData, setCurrData] = useState('')
  const navigate = useNavigate()

  const getContent = async (): Promise<void> => {
    setCurrData(await getProfileStr(id))
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
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">
          <div className="flex justify-start">
            <div className="flex items-center">编辑订阅</div>
            {props.isRemote && (
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
          <BaseEditor language="yaml" value={currData} onChange={(value) => setCurrData(value)} />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
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
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditFileModal
