import { Chip, Separator, Surface } from '@heroui/react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

interface Props {
  rule: ControllerRulesDetail
  anchorEl: HTMLElement | null
  visible: boolean
}

const TOOLTIP_WIDTH = 228

const isZeroTime = (at: string): boolean =>
  at.startsWith('0001-01-01') || at.startsWith('1970-01-01')

const RuleDetailTooltip: React.FC<Props> = ({ rule, anchorEl, visible }) => {
  const [pos, setPos] = useState<{ top: number; left: number; side: 'left' | 'right' } | null>(null)
  const [finalTop, setFinalTop] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!anchorEl || !visible) {
      setPos(null)
      setFinalTop(null)
      return
    }
    const rect = anchorEl.getBoundingClientRect()
    const vw = window.innerWidth
    const side: 'right' | 'left' = rect.right + TOOLTIP_WIDTH + 14 <= vw ? 'right' : 'left'
    const left = side === 'right' ? rect.right + 6 : rect.left - TOOLTIP_WIDTH - 6
    setPos({ top: rect.top, left, side })
    setFinalTop(null)
  }, [anchorEl, visible])

  useLayoutEffect(() => {
    if (!pos || !panelRef.current || !anchorEl) return
    const vh = window.innerHeight
    const h = panelRef.current.offsetHeight
    setFinalTop(Math.max(8, Math.min(pos.top, vh - h - 8)))
  }, [pos, anchorEl, rule])

  if (!visible || !pos || !anchorEl) return null

  const isPositioned = finalTop !== null
  const displayTop = finalTop ?? pos.top
  const { side } = pos

  const anchorRect = anchorEl.getBoundingClientRect()
  const anchorMidRelative = anchorRect.top + anchorRect.height / 2 - displayTop
  const tooltipH = panelRef.current?.offsetHeight ?? 120
  const arrowTop = Math.max(10, Math.min(anchorMidRelative - 6, tooltipH - 22))

  const { hitCount, hitAt, missCount, missAt } = rule.extra
  const totalCount = hitCount + missCount
  const hitRate = totalCount > 0 ? (hitCount / totalCount) * 100 : 0

  return createPortal(
    <div
      className="fixed pointer-events-none"
      style={{
        top: displayTop,
        left: pos.left,
        zIndex: 9999,
        width: TOOLTIP_WIDTH,
        visibility: isPositioned ? 'visible' : 'hidden',
        transformOrigin: side === 'right' ? 'left center' : 'right center',
        animation: isPositioned
          ? `proxy-tooltip-in-${side} 0.18s cubic-bezier(0.16,1,0.3,1) both`
          : 'none'
      }}
    >
      <div
        className={`absolute z-2 size-2.5 rotate-45 border-default-200/70 bg-surface-secondary ${side === 'right' ? 'border-b border-l' : 'border-t border-r'}`}
        style={{
          top: arrowTop + 1,
          [side === 'right' ? 'left' : 'right']: -4
        }}
      />

      <Surface
        ref={panelRef}
        variant="secondary"
        className="relative z-1 overflow-hidden rounded-xl shadow-md border border-default-200/70"
      >
        <div className="flex items-start gap-2 px-3 pt-2.5 pb-2">
          <span className="text-xs font-semibold min-w-0 flex-1 whitespace-normal wrap-anywhere leading-5">
            {rule.payload || 'Match'}
          </span>
        </div>

        <Separator className="mx-3 w-auto bg-default-200/70" />

        <div className="px-3 py-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-center">
          <span className="text-[10px] text-muted">类型</span>
          <Chip className="justify-self-end" variant="soft" size="sm">
            {rule.type}
          </Chip>

          <span className="text-[10px] text-muted">代理</span>
          <span className="text-[10px] flag-emoji text-muted min-w-0 text-right whitespace-normal wrap-anywhere">
            {rule.proxy}
          </span>

          {rule.size > 0 && (
            <>
              <span className="text-[10px] text-muted">大小</span>
              <span className="text-[10px] text-muted justify-self-end">{rule.size}</span>
            </>
          )}

          {totalCount > 0 ? (
            <>
              <span className="text-[10px] text-muted">命中率</span>
              <span className="text-[10px] text-muted justify-self-end">{hitRate.toFixed(1)}%</span>

              <span className="text-[10px] text-muted">命中次数</span>
              <span className="text-[10px] text-muted justify-self-end">{hitCount}</span>

              <span className="text-[10px] text-muted">总次数</span>
              <span className="text-[10px] text-muted justify-self-end">{totalCount}</span>

              {!isZeroTime(hitAt) && (
                <>
                  <span className="text-[10px] text-muted">最后命中</span>
                  <span className="text-[10px] text-muted justify-self-end">
                    {dayjs(hitAt).fromNow()}
                  </span>
                </>
              )}

              {missCount > 0 && !isZeroTime(missAt) && (
                <>
                  <span className="text-[10px] text-muted">最后放行</span>
                  <span className="text-[10px] text-muted justify-self-end">
                    {dayjs(missAt).fromNow()}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="text-[10px] text-muted">统计</span>
              <span className="text-[10px] text-muted/50 justify-self-end">暂无数据</span>
            </>
          )}
        </div>
      </Surface>
    </div>,
    document.body
  )
}

export default RuleDetailTooltip
