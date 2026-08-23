import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { closestCorners, DndContext, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { useNavigate } from 'react-router-dom'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useCardDndSensors } from '@renderer/hooks/use-card-dnd-sensors'
import { markInitialContentPartReady } from '@renderer/utils/startup'
import ConnCard from './conn-card'
import DNSCard from './dns-card'
import LogCard from './log-card'
import MihomoCoreCard from './mihomo-core-card'
import OverrideCard from './override-card'
import ProfileCard from './profile-card'
import ProxyCard from './proxy-card'
import ResourceCard from './resource-card'
import RuleCard from './rule-card'
import SniffCard from './sniff-card'
import SubStoreCard from './substore-card'
import SysproxySwitcher from './sysproxy-switcher'
import TunSwitcher from './tun-switcher'

const interactiveSelector = 'button:not(.pointer-events-none), [role="switch"]'

const defaultSiderOrder = [
  'sysproxy',
  'tun',
  'dns',
  'sniff',
  'proxy',
  'connection',
  'profile',
  'mihomo',
  'rule',
  'resource',
  'override',
  'log',
  'substore'
]

const siderCardRouteMap = {
  'sysproxy-card': '/sysproxy',
  'tun-card': '/tun',
  'profile-card': '/profiles',
  'proxy-card': '/proxies',
  'mihomo-core-card': '/mihomo',
  'conn-card': '/connections',
  'dns-card': '/dns',
  'sniff-card': '/sniffer',
  'log-card': '/logs',
  'rule-card': '/rules',
  'resource-card': '/resources',
  'override-card': '/override',
  'substore-card': '/substore'
} as const

const siderCardSelector = Object.keys(siderCardRouteMap)
  .map((className) => `.${className}`)
  .join(', ')

const componentMap = {
  sysproxy: SysproxySwitcher,
  tun: TunSwitcher,
  profile: ProfileCard,
  proxy: ProxyCard,
  mihomo: MihomoCoreCard,
  connection: ConnCard,
  dns: DNSCard,
  sniff: SniffCard,
  log: LogCard,
  rule: RuleCard,
  resource: ResourceCard,
  override: OverrideCard,
  substore: SubStoreCard
}

interface Props {
  iconOnly?: boolean
}

export default function SiderCards({ iconOnly = false }: Props): React.JSX.Element {
  const { appConfig, patchAppConfig } = useAppConfig()
  const siderOrder = appConfig?.siderOrder ?? defaultSiderOrder
  const [order, setOrder] = useState(siderOrder)
  const suppressClickRef = useRef(false)
  const suppressClickTimerRef = useRef<number | undefined>(undefined)
  const navigate = useNavigate()
  const sensors = useCardDndSensors({ mouseDistance: 8, touchDelay: 220, touchTolerance: 10 })

  useEffect(() => {
    setOrder(siderOrder)
  }, [siderOrder])

  useLayoutEffect(() => {
    markInitialContentPartReady('sider')
  }, [])

  useEffect(() => {
    return (): void => {
      if (suppressClickTimerRef.current) {
        window.clearTimeout(suppressClickTimerRef.current)
      }
    }
  }, [])

  const releaseClickSuppression = (): void => {
    if (suppressClickTimerRef.current) {
      window.clearTimeout(suppressClickTimerRef.current)
    }
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false
    }, 160)
  }

  const onDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const newOrder = order.slice()
      const activeIndex = newOrder.indexOf(active.id as string)
      const overIndex = newOrder.indexOf(over.id as string)
      newOrder.splice(activeIndex, 1)
      newOrder.splice(overIndex, 0, active.id as string)
      setOrder(newOrder)
      await patchAppConfig({ siderOrder: newOrder })
    }
  }

  const onClickCapture = (event: MouseEvent<HTMLDivElement>): void => {
    if (suppressClickRef.current) {
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const target = event.target as HTMLElement
    if (target.closest(interactiveSelector)) return

    const clickedCard = target.closest(siderCardSelector)
    if (!clickedCard) return

    const route = Object.entries(siderCardRouteMap).find(([className]) =>
      clickedCard.classList.contains(className)
    )?.[1]
    if (route) navigate(route)
  }

  const cards = order.map((key: string) => {
    const Component = componentMap[key]
    if (!Component) return null
    return <Component key={key} iconOnly={iconOnly} />
  })

  if (iconOnly) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <div className="min-h-full w-full flex flex-col gap-2">{cards}</div>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'clip' }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={() => {
          suppressClickRef.current = true
        }}
        onDragCancel={releaseClickSuppression}
        onDragEnd={(event) => {
          void onDragEnd(event).finally(releaseClickSuppression)
        }}
      >
        <div className="grid grid-cols-2 gap-2 m-2" onClickCapture={onClickCapture}>
          <SortableContext items={order}>{cards}</SortableContext>
        </div>
      </DndContext>
    </div>
  )
}
