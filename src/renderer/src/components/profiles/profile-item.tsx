import { Button, Tooltip, Card, Chip, Dropdown, Label, Meter } from '@heroui/react'
import { Pressable } from 'react-aria'

import { calcTraffic } from '@renderer/utils/calc'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useEffect, useMemo, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { openFile } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import ConfirmModal from '../base/base-confirm'
import QRCodeModal from '../base/base-qrcode-modal'

interface Props {
  info: ProfileItem
  isCurrent: boolean
  addProfileItem: (item: Partial<ProfileItem>) => Promise<void>
  updateProfileItem: (item: ProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  mutateProfileConfig: () => void
  onClick: () => Promise<void>
  switching: boolean
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger'
  className: string
}

const ProfileItem: React.FC<Props> = (props) => {
  const {
    info,
    addProfileItem,
    removeProfileItem,
    mutateProfileConfig,
    updateProfileItem,
    onClick,
    isCurrent,
    switching
  } = props
  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0
  const { appConfig, patchAppConfig } = useAppConfig()
  const { profileDisplayDate = 'expire' } = appConfig || {}
  const [updating, setUpdating] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [openInfoEditor, setOpenInfoEditor] = useState(false)
  const [openFileEditor, setOpenFileEditor] = useState(false)
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
  const [disableSelect, setDisableSelect] = useState(false)
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
        showDivider: !(info.type === 'remote' && info.url),
        color: 'default',
        className: ''
      } as MenuItem,
      ...(info.type === 'remote' && info.url
        ? [
            {
              key: 'qrcode',
              label: '二维码',
              showDivider: true,
              color: 'default',
              className: ''
            } as MenuItem
          ]
        : []),
      {
        key: 'delete',
        label: '删除',
        showDivider: false,
        color: 'danger',
        className: 'text-danger'
      } as MenuItem
    ]
    if (info.home) {
      list.unshift({
        key: 'home',
        label: '主页',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem)
    }
    return list
  }, [info])

  const onMenuAction = async (key: Key): Promise<void> => {
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
        openFile('profile', info.id)
        break
      }
      case 'qrcode': {
        setShowQrCode(true)
        break
      }
      case 'delete': {
        setConfirmOpen(true)
        break
      }

      case 'home': {
        open(info.home)
        break
      }
    }
  }

  useEffect(() => {
    if (isDragging) {
      setDisableSelect(true)
      return
    }

    const timer = window.setTimeout(() => {
      setDisableSelect(false)
    }, 160)

    return (): void => window.clearTimeout(timer)
  }, [isDragging])

  return (
    <div
      ref={setNodeRef}
      className="grid col-span-1 touch-sortable-card"
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
          isRemote={info.type === 'remote'}
          onClose={() => setOpenFileEditor(false)}
        />
      )}
      {openInfoEditor && (
        <EditInfoModal
          item={info}
          isCurrent={isCurrent}
          onClose={() => setOpenInfoEditor(false)}
          updateProfileItem={updateProfileItem}
        />
      )}
      {showQrCode && info.url && (
        <QRCodeModal title={info.name} url={info.url} onClose={() => setShowQrCode(false)} />
      )}
      {confirmOpen && (
        <ConfirmModal
          onChange={setConfirmOpen}
          title="确认删除配置？"
          confirmText="确认删除"
          cancelText="取消"
          onConfirm={() => {
            removeProfileItem(info.id)
            mutateProfileConfig()
          }}
        />
      )}
      <Pressable
        onPress={() => {
          if (disableSelect || switching) return
          setSelecting(true)
          onClick().finally(() => {
            setSelecting(false)
          })
        }}
      >
        <Card
          className={['w-full', `${isCurrent ? 'bg-primary' : ''} ${selecting ? 'blur-sm' : ''}`]
            .filter(Boolean)
            .join(' ')}
          data-pressable="true"
          role="button"
          tabIndex={0}
        >
          <div {...attributes} {...listeners} className="w-full h-full">
            <Card.Content className="pb-1">
              <div className="flex justify-between h-8 gap-1">
                <div className="flex min-w-0 items-center">
                  <h3
                    title={info?.name}
                    className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-8 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                  >
                    {info?.name}
                  </h3>
                </div>
                <div className="flex shrink-0" data-no-dnd onClick={(e) => e.stopPropagation()}>
                  {info.type === 'remote' && (
                    <Tooltip delay={0}>
                      <Button
                        isIconOnly
                        size="sm"
                        onPress={async () => {
                          setUpdating(true)
                          await addProfileItem(info)
                          setUpdating(false)
                        }}
                        variant="ghost"
                        data-color="default"
                        isDisabled={updating}
                      >
                        <IoMdRefresh
                          color="default"
                          className={`${isCurrent ? 'text-primary-foreground' : 'text-foreground'} text-[24px] ${updating ? 'animate-spin' : ''}`}
                        />
                      </Button>
                      <Tooltip.Content placement="left">
                        {dayjs(info.updated).fromNow()}
                      </Tooltip.Content>
                    </Tooltip>
                  )}

                  <Dropdown>
                    <>
                      <Button isIconOnly size="sm" variant="ghost" data-color="default">
                        <IoMdMore
                          color="default"
                          className={`text-[24px] ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                        />
                      </Button>
                    </>
                    <Dropdown.Popover>
                      <Dropdown.Menu onAction={onMenuAction}>
                        {menuItems.map((item) => (
                          <Dropdown.Item
                            key={item.key}
                            id={item.key}
                            data-divider={item.showDivider}
                            data-color={item.color}
                            className={['app-dropdown-item', item.className]
                              .filter(Boolean)
                              .join(' ')}
                            textValue={item.label}
                          >
                            <Label>{item.label}</Label>
                          </Dropdown.Item>
                        ))}
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>
              </div>
              {info.type === 'remote' && extra && (
                <div
                  className={`mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  <small>{`${calcTraffic(usage)}/${calcTraffic(total)}`}</small>
                  {profileDisplayDate === 'expire' ? (
                    <Button
                      size="sm"
                      onPress={async () => {
                        await patchAppConfig({ profileDisplayDate: 'update' })
                      }}
                      variant="ghost"
                      data-color="default"
                      className={`h-5 p-1 m-0 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                    >
                      {extra.expire ? dayjs.unix(extra.expire).format('YYYY-MM-DD') : '长期有效'}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onPress={async () => {
                        await patchAppConfig({ profileDisplayDate: 'expire' })
                      }}
                      variant="ghost"
                      data-color="default"
                      className={`h-5 p-1 m-0 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                    >
                      {dayjs(info.updated).fromNow()}
                    </Button>
                  )}
                </div>
              )}
            </Card.Content>
            <Card.Footer className="pt-0">
              {info.type === 'remote' && !extra && (
                <div
                  className={`w-full mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  <Chip
                    size="sm"
                    data-color="default"
                    variant="tertiary"
                    data-outline="true"
                    className={[
                      `${isCurrent ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <Chip.Label>远程</Chip.Label>
                  </Chip>
                  <small>{dayjs(info.updated).fromNow()}</small>
                </div>
              )}
              {info.type === 'local' && (
                <div
                  className={`mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  <Chip
                    size="sm"
                    data-color="default"
                    variant="tertiary"
                    data-outline="true"
                    className={[
                      `${isCurrent ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <Chip.Label>本地</Chip.Label>
                  </Chip>
                </div>
              )}
              {extra && (
                <Meter aria-label="流量用量" maxValue={total} value={usage}>
                  <Meter.Track className={`h-1.5 ${isCurrent ? 'bg-primary-foreground/25' : ''}`}>
                    <Meter.Fill className={isCurrent ? 'bg-primary-foreground' : undefined} />
                  </Meter.Track>
                </Meter>
              )}
            </Card.Footer>
          </div>
        </Card>
      </Pressable>
    </div>
  )
}

export default ProfileItem
