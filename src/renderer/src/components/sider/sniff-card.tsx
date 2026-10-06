import { Button, Card } from '@heroui/react'

import BorderSwitch from '@renderer/components/base/border-swtich'
import { RiScan2Fill } from 'react-icons/ri'
import { useLocation } from 'react-router-dom'
import { patchMihomoConfig } from '@renderer/utils/ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React from 'react'
import SiderItem from './sider-item'

interface Props {
  iconOnly?: boolean
  expanded?: boolean
}
const SniffCard: React.FC<Props> = (props) => {
  const { appConfig } = useAppConfig()
  const { iconOnly, expanded } = props
  const {
    sniffCardStatus = 'col-span-1',
    controlSniff = true,
    disableAnimation = false
  } = appConfig || {}
  const location = useLocation()
  const match = location.pathname.includes('/sniffer')
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { sniffer } = controledMihomoConfig || {}
  const { enable } = sniffer || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'sniff'
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const onChange = async (enable: boolean): Promise<void> => {
    await patchControledMihomoConfig({ sniffer: { enable } })
    await patchMihomoConfig({ sniffer: { enable } })
  }

  if (iconOnly) {
    return (
      <SiderItem
        className={`${sniffCardStatus} ${!controlSniff ? 'hidden' : ''}`}
        title="域名嗅探"
        route="/sniffer"
        icon={<RiScan2Fill className="text-[20px]" />}
        expanded={expanded}
      >
        <BorderSwitch isShowBorder={match && enable} isSelected={enable} onValueChange={onChange} />
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
      className={`${sniffCardStatus} ${!controlSniff ? 'hidden' : ''} sniff-card`}
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
              <RiScan2Fill
                color="default"
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
              />
            </Button>
            <BorderSwitch
              isShowBorder={match && enable}
              isSelected={enable}
              onValueChange={onChange}
            />
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            域名嗅探
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default SniffCard
