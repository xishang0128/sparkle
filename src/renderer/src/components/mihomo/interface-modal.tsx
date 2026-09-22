import { Button, Modal } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { IoCheckmarkOutline, IoCopyOutline } from 'react-icons/io5'
import { getInterfaces } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  onClose: () => void
}

const InterfaceModal: React.FC<Props> = (props) => {
  const { onClose } = props
  useAppConfig()
  const [info, setInfo] = useState<Record<string, NetworkInterfaceInfo[]>>({})
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  useEffect(() => {
    if (!copiedAddress) return
    const timer = setTimeout(() => setCopiedAddress(null), 2000)
    return () => clearTimeout(timer)
  }, [copiedAddress])
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
                            <div className="inline-flex items-center gap-2 rounded-lg bg-default/40 px-1.5 py-0.5 text-xs">
                              <code>{v.address}</code>
                              <Button
                                size="sm"
                                variant="ghost"
                                isIconOnly
                                aria-label="复制地址"
                                onPress={async () => {
                                  await navigator.clipboard.writeText(v.address)
                                  setCopiedAddress(v.address)
                                }}
                                onBlur={() => setCopiedAddress(null)}
                              >
                                {copiedAddress === v.address ? (
                                  <IoCheckmarkOutline />
                                ) : (
                                  <IoCopyOutline />
                                )}
                              </Button>
                            </div>
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
