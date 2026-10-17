import { Button, Card } from '@heroui/react'
import BorderSwitch from '@renderer/components/base/border-swtich'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useLocation } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import GatewaySetup from '@renderer/components/gateway/setup-modal'
import { useState } from 'react'
import useSWR from 'swr'
import {
  getLanternInterfaces,
  getLanternStatus,
  startLantern,
  stopLantern
} from '@renderer/utils/ipc'
import { notify } from '@renderer/utils/notification'
import { LuNetwork } from 'react-icons/lu'
import SiderItem from './sider-item'

export default function GatewayCard({
  iconOnly,
  expanded
}: {
  iconOnly?: boolean
  expanded?: boolean
}): React.JSX.Element {
  const { appConfig } = useAppConfig()
  const { gatewayCardStatus = 'col-span-1' } = appConfig || {}
  const active = useLocation().pathname === '/gateway'
  const { data, error, mutate } = useSWR('lantern-status', getLanternStatus, {
    refreshInterval: 5000,
    shouldRetryOnError: false
  })
  const [busy, setBusy] = useState(false)
  const [network, setNetwork] = useState<LanternNetwork>()
  const enabled = Boolean(data?.gateway_mode)
  const onChange = async (enable: boolean): Promise<void> => {
    setBusy(true)
    try {
      if (enable) setNetwork(await getLanternInterfaces())
      else await mutate(await stopLantern(), false)
    } catch (e) {
      notify(e, { variant: 'danger' })
      await mutate().catch(() => {})
    } finally {
      setBusy(false)
    }
  }
  const setup = network && (
    <GatewaySetup
      mode="enable"
      options={data?.options}
      network={network}
      active={enabled}
      onClose={() => setNetwork(undefined)}
      onEnable={async (options) => {
        try {
          await mutate(await startLantern(options), false)
        } catch (e) {
          await mutate().catch(() => {})
          throw e
        }
      }}
    />
  )
  const control = (
    <BorderSwitch
      isShowBorder={active && enabled}
      isSelected={enabled}
      isDisabled={busy || !data?.supported || Boolean(error)}
      onValueChange={onChange}
    />
  )
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: 'gateway'
  })
  if (iconOnly)
    return (
      <>
        <SiderItem
          className={gatewayCardStatus}
          title="网关模式"
          route="/gateway"
          icon={<LuNetwork className="text-[20px]" />}
          expanded={expanded}
        >
          {control}
        </SiderItem>
        {setup}
      </>
    )
  return (
    <>
      <Card
        {...attributes}
        {...listeners}
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(
            transform ? { ...transform, scaleX: 1, scaleY: 1 } : null
          ),
          transition
        }}
        className={`gateway-card ${gatewayCardStatus} ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/30'}`}
      >
        <Card.Content className="flex-row items-center justify-between pb-1 pt-0 px-0 overflow-y-visible">
          <Button
            isIconOnly
            variant="secondary"
            data-color="default"
            className="bg-transparent pointer-events-none"
          >
            <LuNetwork
              className={`text-[24px] ${active ? 'text-primary-foreground' : 'text-foreground'}`}
            />
          </Button>
          {control}
        </Card.Content>
        <Card.Footer className="pt-1">
          <h3 className="text-md font-bold">网关模式</h3>
        </Card.Footer>
      </Card>
      {setup}
    </>
  )
}
