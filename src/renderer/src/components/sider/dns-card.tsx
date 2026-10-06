import { Button, Card } from '@heroui/react'

import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { LuServer } from 'react-icons/lu'
import { useLocation } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'
import SiderItem from './sider-item'

interface Props {
  iconOnly?: boolean
  expanded?: boolean
}
const DNSCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, expanded } = props
  const {
    dnsCardStatus = 'col-span-1',
    controlDns = true,
    disableAnimation = false
  } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/dns')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { dns, tun } = controledMihomoConfig || {}
  const { enable = true } = dns || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'dns'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ dns: { enable } })
    await patchMihomoConfig({ dns: { enable } })
  }

  if (iconOnly) {
    return (
      <SiderItem
        className={`${dnsCardStatus} ${!controlDns ? 'hidden' : ''}`}
        title="DNS"
        route="/dns"
        icon={<LuServer className="text-[20px]" />}
        expanded={expanded}
      >
        <BorderSwitch
          isShowBorder={match && enable}
          isSelected={enable}
          isDisabled={tun?.enable}
          onValueChange={onChange}
        />
      </SiderItem>
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
      className={`${dnsCardStatus} ${!controlDns ? 'hidden' : ''} dns-card`}
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
              <LuServer
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
            <BorderSwitch
              isShowBorder={match && enable}
              isSelected={enable}
              isDisabled={tun?.enable}
              onValueChange={onChange}
            />
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            DNS
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default DNSCard
