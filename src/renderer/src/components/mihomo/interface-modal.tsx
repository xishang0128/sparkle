import { Snippet } from '@heroui/react'
import { Modal } from '@heroui-v3/react'
import React, { useEffect, useState } from 'react'
import { getInterfaces } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  onClose: () => void
}

const InterfaceModal: React.FC<Props> = (props) => {
  const { onClose } = props
  useAppConfig()
  const [info, setInfo] = useState<Record<string, NetworkInterfaceInfo[]>>({})
  const getInfo = async (): Promise<void> => {
    setInfo(await getInterfaces())
  }

  useEffect(() => {
    getInfo()
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
              <Modal.Heading>网络信息</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[70vh] overflow-y-auto">
              {Object.entries(info).map(([key, value]) => {
                return (
                  <div key={key}>
                    <h4 className="font-bold">{key}</h4>
                    {value.map((v) => {
                      return (
                        <div key={v.address}>
                          <div className="mt-2 flex justify-between">
                            {v.family}
                            <Snippet symbol="" size="sm">
                              {v.address}
                            </Snippet>
                          </div>
                        </div>
                      )
                    })}
                  </div>
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

export default InterfaceModal
