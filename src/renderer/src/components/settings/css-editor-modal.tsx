import { Button, Modal } from '@heroui-v3/react'
import { BaseEditor } from '@renderer/components/base/base-editor-lazy'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { readTheme } from '@renderer/utils/ipc'
import React, { useEffect, useState } from 'react'
interface Props {
  theme: string
  onCancel: () => void
  onConfirm: (script: string) => void
}
const CSSEditorModal: React.FC<Props> = (props) => {
  const { theme, onCancel, onConfirm } = props
  useAppConfig()
  const [currData, setCurrData] = useState('')

  useEffect(() => {
    if (theme) {
      readTheme(theme).then((css) => {
        setCurrData(css)
      })
    }
  }, [theme])

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onCancel}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="mt-4 h-[calc(100%-32px)] max-w-none w-[calc(100%-100px)]">
            <Modal.Header className="app-drag pb-0">
              <Modal.Heading>编辑主题</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="h-full">
              <BaseEditor
                language="css"
                value={currData}
                onChange={(value) => setCurrData(value || '')}
              />
            </Modal.Body>
            <Modal.Footer className="pt-0 pb-0">
              <Button size="sm" variant="secondary" onPress={onCancel}>
                取消
              </Button>
              <Button size="sm" onPress={() => onConfirm(currData)}>
                确认
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default CSSEditorModal
