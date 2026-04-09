import React from 'react'
import { Modal, ModalContent, ModalHeader, ModalBody } from '@heroui/react'
import { QRCodeSVG } from 'qrcode.react'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  title: string
  url: string
  onClose: () => void
}

const QRCodeModal: React.FC<Props> = ({ title, url, onClose }) => {
  const { appConfig: { disableAnimation = false } = {} } = useAppConfig()

  return (
    <Modal
      backdrop={disableAnimation ? 'transparent' : 'blur'}
      disableAnimation={disableAnimation}
      isOpen={true}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      classNames={{
        backdrop: 'top-[48px]'
      }}
    >
      <ModalContent>
        <ModalHeader className="justify-center">{title}</ModalHeader>
        <ModalBody className="flex items-center pb-6">
          <div className="bg-white p-4 rounded-lg">
            <QRCodeSVG value={url} size={256} />
          </div>
          <p className="mt-2 text-sm text-foreground-500 text-center break-all select-all">
            {url}
          </p>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}

export default QRCodeModal
