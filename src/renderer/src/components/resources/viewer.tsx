import { Button, Modal } from '@heroui-v3/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getFileStr, saveFileStrWithElevation, setFileStr } from '@renderer/utils/ipc'
import yaml from 'js-yaml'
import ConfirmModal from '../base/base-confirm'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'
const FILE_PERMISSION_ELEVATION_REQUIRED = 'FILE_PERMISSION_ELEVATION_REQUIRED'

interface Props {
  onClose: () => void
  path: string
  type: string
  title: string
  privderType: string
  format?: string
}

function getDefaultLanguage(format?: string): Language {
  return !format || format === 'YamlRule' ? 'yaml' : 'text'
}

function getViewerContent(fileContent: string, privderType: string, title: string): string {
  try {
    const parsedYaml = yaml.load(fileContent)
    if (!parsedYaml || typeof parsedYaml !== 'object') {
      return fileContent
    }

    const yamlObj = parsedYaml as Record<string, unknown>
    const payload = yamlObj[privderType]?.[title]?.payload
    if (payload) {
      return yaml.dump(
        privderType === 'proxy-providers' ? { proxies: payload } : { rules: payload }
      )
    }

    const targetObj = yamlObj[privderType]?.[title]
    return targetObj ? yaml.dump(targetObj) : fileContent
  } catch {
    return fileContent
  }
}

const Viewer: React.FC<Props> = (props) => {
  const { type, path, title, format, privderType, onClose } = props
  const [currData, setCurrData] = useState('')
  const [showPermissionConfirm, setShowPermissionConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const language = type === 'Inline' ? 'yaml' : getDefaultLanguage(format)

  const save = async (elevated = false): Promise<void> => {
    setIsSaving(true)
    try {
      await (elevated ? saveFileStrWithElevation(path, currData) : setFileStr(path, currData))
      onClose()
    } catch (e) {
      if (!elevated && typeof e === 'string' && e.includes(FILE_PERMISSION_ELEVATION_REQUIRED)) {
        setShowPermissionConfirm(true)
        return
      }
      alert(e)
    } finally {
      setIsSaving(false)
    }
  }

  const getContent = async (): Promise<void> => {
    const fileContent = await getFileStr(type === 'Inline' ? 'config.yaml' : path)
    setCurrData(getViewerContent(fileContent, privderType, title))
  }

  useEffect(() => {
    getContent()
  }, [format, path, privderType, title, type])

  return (
    <Modal>
      {showPermissionConfirm && (
        <ConfirmModal
          onChange={setShowPermissionConfirm}
          title="保存需要提权"
          description="当前文件或目录没有写入权限。你可以取消本次保存，或者执行提权后修改权限并继续保存。"
          buttons={[
            {
              key: 'cancel',
              text: '取消',
              variant: 'light',
              onPress: () => {}
            },
            {
              key: 'elevate',
              text: '提权保存',
              color: 'primary',
              onPress: () => save(true)
            }
          ]}
          className="w-120"
        />
      )}
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="mt-4 h-[calc(100%-32px)] max-w-none w-[calc(100%-100px)]">
            <Modal.Header className="app-drag pb-0">
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="h-full">
              <BaseEditor
                language={language}
                value={currData}
                readOnly={type != 'File'}
                onChange={(value) => setCurrData(value)}
              />
            </Modal.Body>
            {type == 'File' && (
              <Modal.Footer className="pt-0 pb-0">
                <Button size="sm" isPending={isSaving} onPress={() => save()}>
                  保存
                </Button>
              </Modal.Footer>
            )}
            {type != 'File' && <Modal.CloseTrigger className="app-nodrag" />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default Viewer
