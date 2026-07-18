import { Button, Drawer, Label, Link, ProgressBar } from '@heroui-v3/react'
import ReactMarkdown from 'react-markdown'
import React, { useEffect, useRef, useState } from 'react'
import { downloadAndInstallUpdate } from '@renderer/utils/ipc'
import { FiX, FiDownload } from 'react-icons/fi'
import { notify } from '@renderer/utils/notification'

interface Props {
  version: string
  tag?: string
  changelog: string
  updateStatus?: {
    downloading: boolean
    progress: number
    error?: string
  }
  onCancel?: () => void
  onClose: () => void
  reopenSignal?: number
}

const DRAWER_CLOSE_ANIMATION_MS = 700

const UpdaterDrawer: React.FC<Props> = (props) => {
  const { version, tag, changelog, updateStatus, onCancel, onClose, reopenSignal } = props
  const [downloading, setDownloading] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setIsOpen(true)
  }, [reopenSignal])

  const onUpdate = async (): Promise<void> => {
    try {
      setDownloading(true)
      await downloadAndInstallUpdate(version, tag)
    } catch (e) {
      notify(e, { variant: 'danger' })
      setDownloading(false)
    }
  }

  const handleCancel = (): void => {
    if (updateStatus?.downloading && onCancel) {
      setDownloading(false)
      onCancel()
    } else {
      closeWithAnimation()
    }
  }

  const handleOpenChange = (open: boolean): void => {
    if (!open && !isDownloading) {
      closeWithAnimation()
    }
  }

  const closeWithAnimation = (): void => {
    if (closeTimer.current) return

    setIsOpen(false)
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      onClose()
    }, DRAWER_CLOSE_ANIMATION_MS)
  }

  const isDownloading = updateStatus?.downloading || downloading
  const releaseTag = tag ?? (version.includes('-rolling-') ? 'rolling' : version)
  const releaseUrl = `https://github.com/xishang0128/sparkle/releases/tag/${releaseTag}`

  const progress = Math.max(0, Math.min(100, updateStatus?.progress ?? 0))

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      variant="blur"
      isDismissable={!isDownloading}
      className="top-12 h-[calc(100%-48px)]"
    >
      <Drawer.Content placement="right" className="top-12 h-[calc(100%-48px)] p-3 pl-0">
        <Drawer.Dialog className="updater-drawer h-full w-[min(460px,calc(100vw-32px))] max-w-none overflow-hidden rounded-2xl! border border-separator/70 bg-overlay p-0 shadow-overlay">
          <Drawer.Header className="border-b border-separator/70 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-soft-foreground">
                <FiDownload className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <Drawer.Heading className="truncate text-base font-semibold">
                  {version} 版本就绪
                </Drawer.Heading>
              </div>
            </div>
            {!isDownloading && (
              <Link
                className="app-nodrag shrink-0 text-sm"
                href={releaseUrl}
                target="_blank"
                rel="noreferrer"
              >
                前往 GitHub 下载
              </Link>
            )}
          </Drawer.Header>
          <Drawer.Body className="h-full px-5 py-4 text-foreground">
            {updateStatus?.downloading && (
              <div className="mb-4 rounded-xl border border-separator/70 bg-surface-secondary p-4">
                <ProgressBar aria-label="下载进度" color="accent" size="sm" value={progress}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Label className="text-sm font-medium text-foreground">下载进度</Label>
                    <ProgressBar.Output className="text-sm text-muted" />
                  </div>
                  <ProgressBar.Track>
                    <ProgressBar.Fill />
                  </ProgressBar.Track>
                </ProgressBar>
                {updateStatus.error && (
                  <div className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
                    {updateStatus.error}
                  </div>
                )}
              </div>
            )}
            {!updateStatus?.downloading && (
              <div className="updater-drawer__release select-text">
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
                      <h3 className="text-base font-semibold text-foreground" {...markdownProps} />
                    ),
                    li: ({ children }) => <li>{children}</li>,
                    p: ({ ...markdownProps }) => <p {...markdownProps} />,
                    ul: ({ ...markdownProps }) => <ul {...markdownProps} />
                  }}
                >
                  {changelog}
                </ReactMarkdown>
              </div>
            )}
          </Drawer.Body>
          <Drawer.Footer className="border-t border-separator/70 px-5 py-4">
            <Button
              size="sm"
              className="h-8 min-w-0 px-3 text-sm leading-none"
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
                className="h-8 min-w-0 px-3 text-sm leading-none"
                isPending={downloading}
                onPress={onUpdate}
              >
                <FiDownload />
                立即更新
              </Button>
            )}
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}

export default UpdaterDrawer
