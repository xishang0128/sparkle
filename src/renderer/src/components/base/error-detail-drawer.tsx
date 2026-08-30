import { Button, Drawer } from '@heroui-v3/react'
import React, { useEffect, useState } from 'react'
import { FiCheck, FiCopy } from 'react-icons/fi'
import { notify } from '@renderer/utils/notification'

interface Props {
  title: string
  body: string
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

const ErrorDetailDrawer: React.FC<Props> = (props) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (props.isOpen) setCopied(false)
  }, [props.isOpen, props.body])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(`${props.title}\n\n${props.body}`)
      setCopied(true)
    } catch (error) {
      notify(error, { variant: 'danger' })
    }
  }

  return (
    <Drawer.Backdrop
      isOpen={props.isOpen}
      onOpenChange={props.onOpenChange}
      variant="blur"
      className="top-12 h-[calc(100%-48px)]"
    >
      <Drawer.Content placement="right" className="top-12 h-[calc(100%-48px)] p-3 pl-0">
        <Drawer.Dialog className="flex h-full w-[min(520px,calc(100vw-32px))] max-w-none flex-col overflow-hidden rounded-2xl! border border-separator/70 bg-overlay p-0 shadow-overlay">
          <Drawer.Header className="border-b border-separator/70 px-5 py-4">
            <Drawer.Heading className="text-base font-semibold">错误详情</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="no-scrollbar flex-1 overflow-y-auto px-5 py-4 text-foreground">
            <div className="mb-3 text-sm font-medium">{props.title}</div>
            <pre className="select-text whitespace-pre-wrap wrap-break-word rounded-xl border border-separator/70 bg-surface-secondary p-4 font-mono text-xs leading-5">
              {props.body}
            </pre>
          </Drawer.Body>
          <Drawer.Footer className="border-t border-separator/70 px-5 py-4">
            <Button
              size="sm"
              variant="secondary"
              className="h-8 min-w-0 px-3 text-sm leading-none"
              onPress={() => props.onOpenChange(false)}
            >
              关闭
            </Button>
            <Button
              size="sm"
              className="h-8 min-w-0 px-3 text-sm leading-none"
              onPress={handleCopy}
            >
              {copied ? <FiCheck /> : <FiCopy />}
              {copied ? '已复制' : '复制'}
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}

export default ErrorDetailDrawer
