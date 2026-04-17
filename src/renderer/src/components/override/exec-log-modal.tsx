import { Divider } from '@heroui/react'
import { Modal } from '@heroui-v3/react'
import React, { useEffect, useState } from 'react'
import { getOverride } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  id: string
  onClose: () => void
}

const ExecLogModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  useAppConfig()
  const [logs, setLogs] = useState<string[]>([])

  const getLog = async (): Promise<void> => {
    setLogs((await getOverride(id, 'log')).split('\n').filter(Boolean))
  }

  useEffect(() => {
    getLog()
  }, [])

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog>
            <Modal.Header className="app-drag">
              <Modal.Heading>执行日志</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {logs.map((log, index) => {
                return (
                  <React.Fragment key={`${log}-${index}`}>
                    <small className="break-all select-text">{log}</small>
                    <Divider />
                  </React.Fragment>
                )
              })}
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ExecLogModal
