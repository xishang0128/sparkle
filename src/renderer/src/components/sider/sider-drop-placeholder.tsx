import { useDndContext, type ClientRect } from '@dnd-kit/core'
import type { RefObject } from 'react'
import { siderSortingStrategy } from './sider-sorting'

interface Props {
  order: string[]
  gridRef: RefObject<HTMLDivElement | null>
}

export default function SiderDropPlaceholder({ order, gridRef }: Props): React.JSX.Element | null {
  const { active, over, droppableRects } = useDndContext()
  if (!active || !over || !gridRef.current) return null

  const activeIndex = order.indexOf(String(active.id))
  const overIndex = order.indexOf(String(over.id))
  const activeRect = droppableRects.get(active.id)
  if (!activeRect || activeIndex < 0 || overIndex < 0) return null

  const rects: ClientRect[] = new Array(order.length)
  order.forEach((id, index) => {
    const rect = droppableRects.get(id)
    if (rect) rects[index] = rect
  })
  const target = siderSortingStrategy({
    rects,
    activeIndex,
    overIndex,
    index: activeIndex,
    activeNodeRect: activeRect
  })
  if (!target) return null

  const grid = gridRef.current.getBoundingClientRect()
  return (
    <div
      aria-hidden="true"
      className="sider-drop-placeholder"
      style={{
        width: activeRect.width,
        height: activeRect.height,
        transform: `translate(${activeRect.left + target.x - grid.left}px, ${activeRect.top + target.y - grid.top}px)`
      }}
    />
  )
}
