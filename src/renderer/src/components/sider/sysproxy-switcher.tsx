import { Button, Card } from '@heroui/react'

import BorderSwitch from '@renderer/components/base/border-swtich'
import { useLocation } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { triggerSysProxy } from '@renderer/utils/ipc'
import { AiOutlineGlobal } from 'react-icons/ai'
import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { notify } from '@renderer/utils/notification'
import SiderItem from './sider-item'

interface Props {
  iconOnly?: boolean
  expanded?: boolean
}

const SysproxySwitcher: React.FC<Props> = (props) => {
  const { iconOnly, expanded } = props
  const location = useLocation()
  const match = location.pathname.includes('/sysproxy')
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    sysProxy,
    sysproxyCardStatus = 'col-span-1',
    onlyActiveDevice = false,
    disableAnimation = false
  } = appConfig || {}
  const { enable, mode } = sysProxy || {}
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { 'mixed-port': mixedPort } = controledMihomoConfig || {}
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'sysproxy'
  })

  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const disabled = mixedPort == 0
  const onChange = async (enable: boolean): Promise<void> => {
    if (mode == 'manual' && disabled) return
    try {
      await triggerSysProxy(enable, onlyActiveDevice)
      await patchAppConfig({ sysProxy: { enable } })
      window.electron.ipcRenderer.send('updateFloatingWindow')
      window.electron.ipcRenderer.send('updateTrayMenu')
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  if (iconOnly) {
    return (
      <SiderItem
        className={sysproxyCardStatus}
        title="系统代理"
        route="/sysproxy"
        icon={<AiOutlineGlobal className="text-[20px]" />}
        expanded={expanded}
      >
        <BorderSwitch
          isShowBorder={match && enable}
          isSelected={!(mode != 'auto' && disabled) && enable}
          isDisabled={mode == 'manual' && disabled}
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
      className={`${sysproxyCardStatus} sysproxy-card`}
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
              <AiOutlineGlobal
                className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
              />
            </Button>
            <BorderSwitch
              isShowBorder={match && enable}
              isSelected={!(mode != 'auto' && disabled) && enable}
              isDisabled={mode == 'manual' && disabled}
              onValueChange={onChange}
            />
          </div>
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3
            className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
          >
            系统代理
          </h3>
        </Card.Footer>
      </Card>
    </div>
  )
}

export default SysproxySwitcher
