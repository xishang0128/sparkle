import React from 'react'
import { Button, Modal } from '@heroui-v3/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'

export interface ConfirmButton {
  key: string
  text: string
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'
  variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost'
  onPress: () => void | Promise<void>
}

function mapButtonVariant(
  variant?: ConfirmButton['variant'],
  color?: ConfirmButton['color']
): 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'danger-soft' {
  if (color === 'danger') return 'danger'
  if (color === 'warning') return 'danger-soft'
  if (variant === 'light' || variant === 'flat' || variant === 'faded') return 'secondary'
  if (variant === 'bordered') return 'outline'
  if (variant === 'ghost') return 'ghost'
  return 'primary'
}

interface Props {
  onChange: (open: boolean) => void
  title?: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void | Promise<void>
  buttons?: ConfirmButton[]
  className?: string
}

const ConfirmModal: React.FC<Props> = (props) => {
  const {
    onChange,
    title = '请确认',
    description,
    confirmText = '确认',
    cancelText = '取消',
    onConfirm,
    buttons,
    className
  } = props
  useAppConfig()

  const renderButtons = () => {
    if (buttons && buttons.length > 0) {
      return buttons.map((button) => (
        <Button
          key={button.key}
          size="sm"
          variant={mapButtonVariant(button.variant, button.color)}
          onPress={async () => {
            await button.onPress()
            onChange(false)
          }}
        >
          {button.text}
        </Button>
      ))
    }

    return (
      <>
        <Button size="sm" variant="secondary" onPress={() => onChange(false)}>
          {cancelText}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onPress={async () => {
            if (onConfirm) {
              await onConfirm()
            }
            onChange(false)
          }}
        >
          {confirmText}
        </Button>
      </>
    )
  }

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onChange}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className={['w-100', className].filter(Boolean).join(' ')}>
            <Modal.Header>
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="leading-relaxed">{description}</div>
            </Modal.Body>
            <Modal.Footer className="space-x-2">{renderButtons()}</Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
export default ConfirmModal
