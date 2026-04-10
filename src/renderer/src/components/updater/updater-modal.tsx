import { Button, Label, Link, Modal, ProgressBar } from '@heroui-v3/react'
import ReactMarkdown from 'react-markdown'
import React, { useState } from 'react'
import { downloadAndInstallUpdate } from '@renderer/utils/ipc'
import { FiX, FiDownload } from 'react-icons/fi'

interface Props {
  version: string
  changelog: string
  updateStatus?: {
    downloading: boolean
    progress: number
    error?: string
  }
  onCancel?: () => void
  onClose: () => void
}

const UpdaterModal: React.FC<Props> = (props) => {
  const { version, changelog, updateStatus, onCancel, onClose } = props
  const [downloading, setDownloading] = useState(false)

  const onUpdate = async (): Promise<void> => {
    try {
      setDownloading(true)
      await downloadAndInstallUpdate(version)
    } catch (e) {
      alert(e)
      setDownloading(false)
    }
  }

  const handleCancel = (): void => {
    if (updateStatus?.downloading && onCancel) {
      setDownloading(false)
      onCancel()
    } else {
      onClose()
    }
  }

  const isDownloading = updateStatus?.downloading || downloading
  const releaseUrl = version.includes('beta')
    ? 'https://github.com/xishang0128/sparkle/releases/tag/pre-release'
    : `https://github.com/xishang0128/sparkle/releases/tag/${version}`

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        isDismissable={!isDownloading}
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <div className="flex items-center gap-2">
                <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
                  <FiDownload className="size-5" />
                </Modal.Icon>
                <Modal.Heading>{version} 版本就绪</Modal.Heading>
              </div>
              {!isDownloading && (
                <Link className="app-nodrag" href={releaseUrl} target="_blank" rel="noreferrer">
                  前往下载
                </Link>
              )}
            </Modal.Header>
            <Modal.Body className="h-full">
              {updateStatus?.downloading && (
                <div className="mb-4 space-y-3">
                  <ProgressBar
                    aria-label="下载进度"
                    color="accent"
                    size="sm"
                    value={updateStatus.progress}
                  >
                    <Label>下载进度</Label>
                    <ProgressBar.Output />
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                  {updateStatus.error && (
                    <div className="text-sm text-danger">{updateStatus.error}</div>
                  )}
                </div>
              )}
              {!updateStatus?.downloading && (
                <div className="markdown-body select-text">
                  <ReactMarkdown
                    components={{
                      a: ({ ...markdownProps }) => (
                        <Link href={markdownProps.href} target="_blank" rel="noreferrer">
                          {markdownProps.children}
                        </Link>
                      ),
                      code: ({ children }) => (
                        <code className="rounded-md bg-default px-1.5 py-0.5 text-sm">
                          {children}
                        </code>
                      ),
                      h3: ({ ...markdownProps }) => (
                        <h3 className="text-lg font-bold" {...markdownProps} />
                      ),
                      li: ({ children }) => <li className="list-disc list-inside">{children}</li>
                    }}
                  >
                    {changelog}
                  </ReactMarkdown>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer className="pt-0 pb-0">
              <Button
                size="sm"
                className="h-7 min-w-0 px-3 text-sm leading-none"
                variant="secondary"
                onPress={handleCancel}
              >
                {updateStatus?.downloading ? (
                  <>
                    <FiX />
                    取消下载
                  </>
                ) : (
                  '取消'
                )}
              </Button>
              {!updateStatus?.downloading && (
                <Button
                  size="sm"
                  className="h-7 min-w-0 px-3 text-sm leading-none"
                  isPending={downloading}
                  onPress={onUpdate}
                >
                  <FiDownload />
                  立即更新
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default UpdaterModal
