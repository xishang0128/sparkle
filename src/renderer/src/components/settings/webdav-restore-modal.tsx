import { Button, Modal } from '@heroui-v3/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { relaunchApp, webdavDelete, webdavRestore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'
interface Props {
  filenames: string[]
  onClose: () => void
}
const WebdavRestoreModal: React.FC<Props> = (props) => {
  const { filenames: names, onClose } = props
  useAppConfig()
  const [filenames, setFilenames] = useState<string[]>(names)
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
            <Modal.Body>
              {filenames.length === 0 ? (
                <div className="flex justify-center">还没有备份</div>
              ) : (
                filenames.map((filename) => (
                  <div className="flex" key={filename}>
                    <Button
                      size="sm"
                      fullWidth
                      isPending={restoring}
                      variant="secondary"
                      onPress={async () => {
                        setRestoring(true)
                        try {
                          await webdavRestore(filename)
                          await relaunchApp()
                        } catch (e) {
                          alert(`恢复失败：${e}`)
                        } finally {
                          setRestoring(false)
                        }
                      }}
                    >
                      {filename}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-soft"
                      className="ml-2"
                      onPress={async () => {
                        try {
                          await webdavDelete(filename)
                          setFilenames(filenames.filter((name) => name !== filename))
                        } catch (e) {
                          alert(`删除失败：${e}`)
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
