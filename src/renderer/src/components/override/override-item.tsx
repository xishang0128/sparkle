import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@heroui/react'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useEffect, useMemo, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ExecLogModal from './exec-log-modal'
import { openFile, restartCore } from '@renderer/utils/ipc'
import ConfirmModal from '../base/base-confirm'
import QRCodeModal from '../base/base-qrcode-modal'

interface Props {
  info: OverrideItem
  addOverrideItem: (item: Partial<OverrideItem>) => Promise<void>
  updateOverrideItem: (item: OverrideItem) => Promise<void>
  removeOverrideItem: (id: string) => Promise<void>
  mutateOverrideConfig: () => void
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger'
  className: string
}

const OverrideItem: React.FC<Props> = (props) => {
  const { info, addOverrideItem, removeOverrideItem, mutateOverrideConfig, updateOverrideItem } =
    props
  const [updating, setUpdating] = useState(false)
  const [openInfoEditor, setOpenInfoEditor] = useState(false)
  const [openFileEditor, setOpenFileEditor] = useState(false)
  const [openLog, setOpenLog] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: info.id
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const [disableOpen, setDisableOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [showQrCode, setShowQrCode] = useState(false)
  const menuItems: MenuItem[] = useMemo(() => {
    const list = [
      {
        key: 'edit-info',
        label: '编辑信息',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'edit-file',
        label: '编辑文件',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'open-file',
        label: '打开文件',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem,
      ...(info.type === 'remote' && info.url
        ? [
            {
              key: 'qrcode',
              label: '二维码',
              showDivider: false,
              color: 'default',
              className: ''
            } as MenuItem
          ]
        : []),
      {
        key: 'exec-log',
        label: '执行日志',
        showDivider: true,
        color: 'default',
        className: ''
      } as MenuItem,
      {
        key: 'delete',
        label: '删除',
        showDivider: false,
        color: 'danger',
        className: 'text-danger'
      } as MenuItem
    ]
    if (info.ext === 'yaml') {
      const execLogIndex = list.findIndex((item) => item.key === 'exec-log')
      if (execLogIndex !== -1) list.splice(execLogIndex, 1)
    }
    // 确保 delete 前的最后一项有分隔线
    const deleteIndex = list.findIndex((item) => item.key === 'delete')
    if (deleteIndex > 0) {
      list[deleteIndex - 1].showDivider = true
    }
    return list
  }, [info])
  const onMenuAction = (key: Key): void => {
    switch (key) {
      case 'edit-info': {
        setOpenInfoEditor(true)
        break
      }
      case 'edit-file': {
        setOpenFileEditor(true)
        break
      }
      case 'open-file': {
        openFile('override', info.id, info.ext)
        break
      }
      case 'qrcode': {
        setShowQrCode(true)
        break
      }
      case 'exec-log': {
        setOpenLog(true)
        break
      }
      case 'delete': {
        setConfirmOpen(true)
        break
      }
    }
  }

  useEffect(() => {
    if (isDragging) {
      setTimeout(() => {
        setDisableOpen(true)
      }, 200)
    } else {
      setTimeout(() => {
        setDisableOpen(false)
      }, 200)
    }
  }, [isDragging])

  return (
    <div
      className="grid col-span-1"
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
    >
      {openFileEditor && (
        <EditFileModal
          id={info.id}
          language={info.ext === 'yaml' ? 'yaml' : 'javascript'}
          onClose={() => setOpenFileEditor(false)}
        />
      )}
      {openInfoEditor && (
        <EditInfoModal
          item={info}
          onClose={() => setOpenInfoEditor(false)}
          updateOverrideItem={updateOverrideItem}
        />
      )}
      {showQrCode && info.url && (
        <QRCodeModal
          title={info.name}
          url={info.url}
          onClose={() => setShowQrCode(false)}
        />
      )}
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title="确认删除覆写？"
          confirmText="确认删除"
          cancelText="取消"
          onConfirm={() => {
            removeOverrideItem(info.id)
            mutateOverrideConfig()
          }}
        />
      )}
      {openLog && <ExecLogModal id={info.id} onClose={() => setOpenLog(false)} />}
      <Card
        as="div"
        fullWidth
        isPressable
        onPress={() => {
          if (disableOpen) return
          setOpenFileEditor(true)
        }}
      >
        <div ref={setNodeRef} {...attributes} {...listeners} className="h-full w-full">
          <CardBody>
            <div className="flex justify-between h-8">
              <h3
                title={info?.name}
                className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-8 text-foreground`}
              >
                {info?.name}
              </h3>
              <div className="flex" onClick={(e) => e.stopPropagation()}>
                {info.type === 'remote' && (
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    color="default"
                    disabled={updating}
                    onPress={async () => {
                      setUpdating(true)
                      try {
                        await addOverrideItem(info)
                        await restartCore()
                      } catch (e) {
                        alert(e)
                      } finally {
                        setUpdating(false)
                      }
                    }}
                  >
                    <IoMdRefresh
                      color="default"
                      className={`text-[24px] ${updating ? 'animate-spin' : ''}`}
                    />
                  </Button>
                )}

                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light" color="default">
                      <IoMdMore color="default" className={`text-[24px]`} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu onAction={onMenuAction}>
                    {menuItems.map((item) => (
                      <DropdownItem
                        showDivider={item.showDivider}
                        key={item.key}
                        color={item.color}
                        className={item.className}
                      >
                        {item.label}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
            <div className="flex justify-between">
              <div className={`mt-2 flex justify-start`}>
                {info.global && (
                  <Chip size="sm" variant="dot" color="primary" className="mr-2">
                    全局
                  </Chip>
                )}
                <Chip size="sm" variant="bordered">
                  {info.ext === 'yaml' ? 'YAML' : 'JavaScript'}
                </Chip>
              </div>
              {info.type === 'remote' && (
                <div className={`mt-2 flex justify-end`}>
                  <small>{dayjs(info.updated).fromNow()}</small>
                </div>
              )}
            </div>
          </CardBody>
        </div>
      </Card>
    </div>
  )
}

export default OverrideItem
