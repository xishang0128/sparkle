import { Button, Chip, Card } from '@heroui/react'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { LuGroup } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { useGroups } from '@renderer/hooks/use-groups'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'
import SiderItem from './sider-item'

interface Props {
  iconOnly?: boolean
  expanded?: boolean
}

const ProxyCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, expanded } = props
  const { proxyCardStatus = 'col-span-2', disableAnimation = false } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/proxies')
  const { groups = [] } = useGroups()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'proxy'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  if (iconOnly) {
    return (
      <SiderItem
        className={proxyCardStatus}
        title="代理组"
        route="/proxies"
        icon={<LuGroup className="text-[20px]" />}
        expanded={expanded}
      />
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
      className={`${proxyCardStatus} proxy-card`}
    >
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
              <LuGroup
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
            <Chip
              size="sm"
              data-color="default"
              variant="tertiary"
              data-outline="true"
              className={[
                'mr-2 mt-2',
                match
                  ? 'border-primary-foreground text-primary-foreground'
                  : 'border-primary text-primary'
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <Chip.Label>{groups.length}</Chip.Label>
            </Chip>
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            代理组
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default ProxyCard
