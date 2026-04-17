/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import yaml from 'js-yaml'
import { Button, Modal } from '@heroui-v3/react'
import { BaseEditor } from '../base/base-editor-lazy'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  bypass: string[]
  onCancel: () => void
  onConfirm: (bypass: string[]) => void
}

interface ParsedYaml {
  bypass?: string[]
}

const ByPassEditorModal: React.FC<Props> = (props) => {
  const { bypass, onCancel, onConfirm } = props
  useAppConfig()
  const [currData, setCurrData] = useState<string>('')
  useEffect(() => {
    setCurrData(yaml.dump({ bypass }))
  }, [bypass])
  const handleConfirm = (): void => {
    try {
      const parsed = yaml.load(currData) as ParsedYaml
      if (parsed && Array.isArray(parsed.bypass)) {
        onConfirm(parsed.bypass)
      } else {
        alert('YAML 格式错误')
      }
    } catch (e) {
      alert('YAML 解析失败：' + e)
    }
  }

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
              <Modal.Heading>编辑绕过列表 (YAML)</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="h-full">
              <BaseEditor
                language="yaml"
                value={currData}
                onChange={(value) => setCurrData(value || '')}
              />
            </Modal.Body>
            <Modal.Footer className="pt-0 pb-0">
              <Button size="sm" variant="secondary" onPress={onCancel}>
                取消
              </Button>
              <Button size="sm" onPress={handleConfirm}>
                确认
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ByPassEditorModal
