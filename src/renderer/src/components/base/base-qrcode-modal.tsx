import React from 'react'
import { Modal } from '@heroui-v3/react'
import { QRCodeSVG } from 'qrcode.react'

interface Props {
  title: string
  url: string
  onClose: () => void
}

const QRCodeModal: React.FC<Props> = ({ title, url, onClose }) => {
  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        variant="blur"
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container>
          <Modal.Dialog className="w-full max-w-md">
            <Modal.Header className="justify-center">
              <Modal.Heading>{title}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex items-center pb-6">
              <div className="rounded-lg bg-white p-4">
                <QRCodeSVG value={url} size={256} />
              </div>
              <p className="mt-2 break-all text-center text-sm text-foreground-500 select-all">
                {url}
              </p>
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default QRCodeModal
