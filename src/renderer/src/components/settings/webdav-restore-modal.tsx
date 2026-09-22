import { Button, Modal } from '@heroui/react'
import { relaunchApp, webdavDelete, webdavRestore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'
import { notify } from '@renderer/utils/notification'
interface Props {
  filenames: string[]
  onClose: () => void
}
const WebdavRestoreModal: React.FC<Props> = (props) => {
  const { filenames: names, onClose } = props
  const [filenames, setFilenames] = useState<string[]>([...names].reverse())
  const [restoring, setRestoring] = useState(false)

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
              <Modal.Heading>恢复备份</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-2 pb-4">
              {filenames.length === 0 ? (
                <div className="flex justify-center">还没有备份</div>
              ) : (
                filenames.map((filename) => (
                  <div className="flex gap-2" key={filename}>
                    <Button
                      size="sm"
                      fullWidth
                      className="h-8 min-h-8 rounded-lg"
                      isPending={restoring}
                      variant="secondary"
                      onPress={async () => {
                        setRestoring(true)
                        try {
                          await webdavRestore(filename)
                          await relaunchApp()
                        } catch (e) {
                          notify(`恢复失败：${e}`, { variant: 'danger' })
                        } finally {
                          setRestoring(false)
                        }
                      }}
                    >
                      {filename}
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 min-h-8 min-w-8 rounded-lg px-2"
                      variant="danger-soft"
                      onPress={async () => {
                        try {
                          await webdavDelete(filename)
                          setFilenames(filenames.filter((name) => name !== filename))
                        } catch (e) {
                          notify(`删除失败：${e}`, { variant: 'danger' })
                        }
                      }}
                    >
                      <MdDeleteForever className="text-lg" />
                    </Button>
                  </div>
                ))
              )}
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default WebdavRestoreModal
