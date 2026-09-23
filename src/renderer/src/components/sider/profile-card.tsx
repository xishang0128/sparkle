import { Button, Tooltip, Card, Chip, Meter } from '@heroui/react'

import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import { CgLoadbarDoc } from 'react-icons/cg'
import { IoMdRefresh } from 'react-icons/io'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import React, { useState } from 'react'
import ConfigViewer from './config-viewer'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { TiFolder } from 'react-icons/ti'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  iconOnly?: boolean
}

const ProfileCard: React.FC<Props> = (props) => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { iconOnly } = props
  const {
    profileCardStatus = 'col-span-2',
    profileDisplayDate = 'expire',
    disableAnimation = false
  } = appConfig || {}
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/profiles')
  const [updating, setUpdating] = useState(false)
  const [showRuntimeConfig, setShowRuntimeConfig] = useState(false)
  const { profileConfig, addProfileItem } = useProfileConfig()
  const { current, items } = profileConfig ?? {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'profile'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const info = items?.find((item) => item.id === current) ?? {
    id: 'default',
    type: 'local',
    name: '空白订阅'
  }

  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0

  if (iconOnly) {
    return (
      <div className={`${profileCardStatus} flex justify-center`}>
        <Tooltip delay={0}>
          <Button
            size="sm"
            isIconOnly
            onPress={() => {
              navigate('/profiles')
            }}
            variant={match ? 'primary' : 'ghost'}
            data-color={match ? 'primary' : 'default'}
          >
            <TiFolder className="text-[20px]" />
          </Button>
          <Tooltip.Content placement="right">{'订阅管理'}</Tooltip.Content>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${profileCardStatus} profile-card`}
    >
      {showRuntimeConfig && <ConfigViewer onClose={() => setShowRuntimeConfig(false)} />}
      {profileCardStatus === 'col-span-2' ? (
        <Card
          {...attributes}
          {...listeners}
          className={[
            'w-full',
            `${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Card.Content className="pb-1">
            <div className="flex justify-between h-8">
              <h3
                title={info?.name}
                className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-8 ${match ? 'text-primary-foreground' : 'text-foreground'} `}
              >
                {info?.name}
              </h3>
              <div className="flex">
                <Button
                  isIconOnly
                  size="sm"
                  onPress={() => {
                    setShowRuntimeConfig(true)
                  }}
                  variant="ghost"
                  data-color="default"
                >
                  <CgLoadbarDoc
                    className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'}`}
                  />
                </Button>
                {info.type === 'remote' && (
                  <Tooltip delay={1000}>
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
                        className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'} ${updating ? 'animate-spin' : ''}`}
                      />
                    </Button>
                    <Tooltip.Content placement="left">
                      {dayjs(info.updated).fromNow()}
                    </Tooltip.Content>
                  </Tooltip>
                )}
              </div>
            </div>
            {info.type === 'remote' && extra && (
              <div
                className={`mt-2 flex justify-between ${match ? 'text-primary-foreground' : 'text-foreground'} `}
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
                    className={`h-5 p-1 m-0 ${match ? 'text-primary-foreground' : 'text-foreground'}`}
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
                    className={`h-5 p-1 m-0 ${match ? 'text-primary-foreground' : 'text-foreground'}`}
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
                className={`w-full mt-2 flex justify-between ${match ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <Chip
                  size="sm"
                  data-color="default"
                  variant="tertiary"
                  data-outline="true"
                  className={[
                    `${match ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`
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
                className={`mt-2 flex justify-between ${match ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <Chip
                  size="sm"
                  data-color="default"
                  variant="tertiary"
                  data-outline="true"
                  className={[
                    `${match ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`
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
                <Meter.Track className={`h-1.5 ${match ? 'bg-primary-foreground/25' : ''}`}>
                  <Meter.Fill className={match ? 'bg-primary-foreground' : undefined} />
                </Meter.Track>
              </Meter>
            )}
          </Card.Footer>
        </Card>
      ) : (
        <Card
          {...attributes}
          {...listeners}
          className={[
            'w-full',
            `${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <Card.Content className="pb-1 pt-0 px-0 overflow-y-visible">
            <div className="flex justify-between">
              <Button
                isIconOnly
                variant="secondary"
                data-color="default"
                className="bg-transparent pointer-events-none"
              >
                <TiFolder
                  color="default"
                  className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
                />
              </Button>
              <Button
                isIconOnly
                onPress={() => {
                  setShowRuntimeConfig(true)
                }}
                variant="secondary"
                data-color="default"
                className="bg-transparent"
              >
                <CgLoadbarDoc
                  className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'}`}
                />
              </Button>
            </div>
          </Card.Content>
          <Card.Footer className="pt-1">
            <h3
              className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              订阅管理
            </h3>
          </Card.Footer>
        </Card>
      )}
    </div>
  )
}

export default ProfileCard
