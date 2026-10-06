import { Button, Card } from '@heroui/react'

import { useLocation } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import SubStoreIcon from '../base/substore-icon'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'
import SiderItem from './sider-item'

interface Props {
  iconOnly?: boolean
  expanded?: boolean
}

const SubStoreCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, expanded } = props
  const {
    substoreCardStatus = 'col-span-1',
    useSubStore = true,
    disableAnimation = false
  } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/substore')
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'substore'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  if (iconOnly) {
    return (
      <SiderItem
        className={`${substoreCardStatus} ${!useSubStore ? 'hidden' : ''}`}
        title="Sub-Store"
        route="/substore"
        icon={<SubStoreIcon className="text-[20px]" />}
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
      className={`${substoreCardStatus} ${!useSubStore ? 'hidden' : ''} substore-card`}
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
              <SubStoreIcon
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            Sub-Store
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default SubStoreCard
