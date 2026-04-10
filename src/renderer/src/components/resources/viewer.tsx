import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { getFileStr, saveFileStrWithElevation, setFileStr } from '@renderer/utils/ipc'
import yaml from 'js-yaml'
import { useAppConfig } from '@renderer/hooks/use-app-config'
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

function getViewerContent(
  fileContent: string,
  privderType: string,
  title: string
): string {
  try {
    const parsedYaml = yaml.load(fileContent)
    if (!parsedYaml || typeof parsedYaml !== 'object') {
      return fileContent
    }

    const yamlObj = parsedYaml as Record<string, unknown>
    const payload = yamlObj[privderType]?.[title]?.payload
    if (payload) {
      return yaml.dump(privderType === 'proxy-providers' ? { proxies: payload } : { rules: payload })
    }

    const targetObj = yamlObj[privderType]?.[title]
    return targetObj ? yaml.dump(targetObj) : fileContent
  } catch {
    return fileContent
  }
}

const Viewer: React.FC<Props> = (props) => {
  const { type, path, title, format, privderType, onClose } = props
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()
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
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">{title}</ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language={language}
            value={currData}
            readOnly={type != 'File'}
            onChange={(value) => setCurrData(value)}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            关闭
          </Button>
          {type == 'File' && (
            <Button
              size="sm"
              color="primary"
              isLoading={isSaving}
              onPress={() => save()}
            >
              保存
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default Viewer
