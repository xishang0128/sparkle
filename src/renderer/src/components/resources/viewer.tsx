import { Button, Modal } from '@heroui-v3/react'
import { Spinner } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import { TextViewer } from '../base/text-viewer'
import {
  getFilePreviewStr,
  getFileStr,
  saveFileStrWithElevation,
  setFileStr
} from '@renderer/utils/ipc'
import { dump, load } from 'js-yaml'
import ConfirmModal from '../base/base-confirm'
import { notify } from '@renderer/utils/notification'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'
const FILE_PERMISSION_ELEVATION_REQUIRED = 'FILE_PERMISSION_ELEVATION_REQUIRED'
const TEXT_VIEWER_LINE_LIMIT = 20000

interface Props {
  onClose: () => void
  path: string
  type: string
  title: string
  providerType: string
  format?: string
  ageSecretKey?: string
}

function getDefaultLanguage(format?: string): Language {
  return !format || format === 'YamlRule' ? 'yaml' : 'text'
}

function getViewerContent(fileContent: string, providerType: string, title: string): string {
  try {
    const parsedYaml = load(fileContent)
    if (!parsedYaml || typeof parsedYaml !== 'object') {
      return fileContent
    }

    const yamlObj = parsedYaml as Record<string, unknown>
    const payload = yamlObj[providerType]?.[title]?.payload
    if (payload) {
      return dump(
        providerType === 'proxy-providers' ? { proxies: payload } : { rules: payload }
      )
    }

    const targetObj = yamlObj[providerType]?.[title]
    return targetObj ? dump(targetObj) : fileContent
  } catch {
    return fileContent
  }
}

function hasManyLines(value: string, limit: number): boolean {
  let lines = 1
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) === 10) {
      lines++
      if (lines > limit) {
        return true
      }
    }
  }
  return false
}

const Viewer: React.FC<Props> = (props) => {
  const { type, path, title, format, providerType, onClose, ageSecretKey } = props
  const [currData, setCurrData] = useState('')
  const [showPermissionConfirm, setShowPermissionConfirm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const language = type === 'Inline' ? 'yaml' : getDefaultLanguage(format)
  const editorLanguage = format === 'MrsRule' ? 'text' : language
  const useTextViewer = type !== 'File' && hasManyLines(currData, TEXT_VIEWER_LINE_LIMIT)

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
      notify(e, { variant: 'danger' })
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    let canceled = false

    if (type !== 'Inline' && !path) {
      setIsLoading(true)
      setCurrData('')
      return () => {
        canceled = true
      }
    }

    const loadContent = async (): Promise<void> => {
      setIsLoading(true)
      try {
        const fileContent = await (format === 'MrsRule'
          ? getFilePreviewStr(path, format)
          : getFileStr(type === 'Inline' ? 'config.yaml' : path, ageSecretKey))

        if (canceled) return
        setCurrData(
          format === 'MrsRule' ? fileContent : getViewerContent(fileContent, providerType, title)
        )
      } catch (e) {
        if (!canceled) {
          notify(e, { variant: 'danger' })
        }
      } finally {
        if (!canceled) {
          setIsLoading(false)
        }
      }
    }

    loadContent()
    return () => {
      canceled = true
    }
  }, [ageSecretKey, format, path, providerType, title, type])

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
              {isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Spinner size="lg" />
                </div>
              ) : useTextViewer ? (
                <TextViewer value={currData} />
              ) : (
                <BaseEditor
                  language={editorLanguage}
                  value={currData}
                  readOnly={type !== 'File'}
                  onChange={(value) => setCurrData(value)}
                />
              )}
            </Modal.Body>
            {type === 'File' && !isLoading && (
              <Modal.Footer className="pt-0 pb-0">
                <Button size="sm" variant="secondary" isDisabled={isSaving} onPress={onClose}>
                  取消
                </Button>
                <Button size="sm" isPending={isSaving} onPress={() => save()}>
                  保存
                </Button>
              </Modal.Footer>
            )}
            {type !== 'File' && <Modal.CloseTrigger className="app-nodrag" />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default Viewer
