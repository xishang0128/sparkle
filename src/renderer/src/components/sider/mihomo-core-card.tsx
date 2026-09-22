import { Button, Tooltip, Card } from '@heroui/react'

import { calcTraffic } from '@renderer/utils/calc'
import { mihomoVersion, restartCore } from '@renderer/utils/ipc'
import React, { useEffect, useState } from 'react'
import { IoMdRefresh } from 'react-icons/io'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLocation, useNavigate } from 'react-router-dom'
import PubSub from 'pubsub-js'
import useSWR from 'swr'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { LuCpu } from 'react-icons/lu'
import { notify } from '@renderer/utils/notification'

interface Props {
  iconOnly?: boolean
}

const MihomoCoreCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly } = props
  const { mihomoCoreCardStatus = 'col-span-2', disableAnimation = false } = appConfig || {}
  const { data: version, mutate } = useSWR('mihomoVersion', mihomoVersion, {
    errorRetryInterval: 200,
    errorRetryCount: 10
  })
  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/mihomo')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'mihomo'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const [mem, setMem] = useState(0)
  const [restarting, setRestarting] = useState(false)

  useEffect(() => {
    const token = PubSub.subscribe('mihomo-core-changed', () => {
      mutate()
    })
    const unsubscribeMihomoMemory = window.electron.ipcRenderer.on(
      'mihomoMemory',
      (_e, info: ControllerMemory) => {
        setMem(info.inuse)
      }
    )
    const unsubscribeCoreStarted = window.electron.ipcRenderer.on('core-started', () => {
      mutate()
    })
    return (): void => {
      PubSub.unsubscribe(token)
      unsubscribeMihomoMemory()
      unsubscribeCoreStarted()
    }
  }, [])

  if (iconOnly) {
    return (
      <div className={`${mihomoCoreCardStatus} flex justify-center`}>
        <Tooltip delay={0}>
          <Button
            size="sm"
            isIconOnly
            onPress={() => {
              navigate('/mihomo')
            }}
            variant={match ? 'primary' : 'ghost'}
            data-color={match ? 'primary' : 'default'}
          >
            <LuCpu className="text-[20px]" />
          </Button>
          <Tooltip.Content placement="right">{'内核设置'}</Tooltip.Content>
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
      className={`${mihomoCoreCardStatus} mihomo-core-card`}
    >
      {mihomoCoreCardStatus === 'col-span-2' ? (
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
          <Card.Content>
            <div className="flex justify-between h-8">
              <h3
                className={`text-md font-bold leading-8 ${match ? 'text-primary-foreground' : 'text-foreground'} `}
              >
                {version?.version ?? '-'}
              </h3>

              <Button
                isIconOnly
                size="sm"
                onPress={async () => {
                  try {
                    setRestarting(true)
                    await restartCore()
                    await new Promise((resolve) => {
                      setTimeout(resolve, 2000)
                    })
                    setRestarting(false)
                  } catch (e) {
                    notify(e, { variant: 'danger' })
                  } finally {
                    mutate()
                  }
                }}
                variant="ghost"
                data-color="default"
                isDisabled={restarting}
              >
                <IoMdRefresh
                  className={`text-[24px] ${match ? 'text-primary-foreground' : 'text-foreground'} ${restarting ? 'animate-spin' : ''}`}
                />
              </Button>
            </div>
          </Card.Content>
          <Card.Footer className="pt-1">
            <div
              className={`flex justify-between w-full text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              <h4>内核设置</h4>
              <h4>{calcTraffic(mem)}</h4>
            </div>
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
                <LuCpu
                  color="default"
                  className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
                />
              </Button>
            </div>
          </Card.Content>
          <Card.Footer className="pt-1">
            <h3
              className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              内核设置
            </h3>
          </Card.Footer>
        </Card>
      )}
    </div>
  )
}

export default MihomoCoreCard
