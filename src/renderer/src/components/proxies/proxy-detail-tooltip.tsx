import { Chip, Separator, Surface } from '@heroui/react'
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  proxy: ControllerProxiesDetail | ControllerGroupDetail
  anchorEl: HTMLElement | null
  visible: boolean
}

const TOOLTIP_WIDTH = 228
const SPARK_W = 200
const BAR_H = 28
const LABEL_H = 14
const CHART_H = BAR_H + LABEL_H

const isGroupProxy = (
  p: ControllerProxiesDetail | ControllerGroupDetail
): p is ControllerGroupDetail => 'now' in p

type DelayColor = 'default' | 'accent' | 'success' | 'warning' | 'danger'

function getDelayChipColor(delay: number): DelayColor {
  if (delay === -1) return 'default'
  if (delay === 0) return 'danger'
  if (delay < 500) return 'success'
  return 'warning'
}

function getDelayText(delay: number): string {
  if (delay === -1) return '未测试'
  if (delay === 0) return '超时'
  return `${delay}ms`
}

function getDelayLabel(delay: number): string {
  if (delay === -1) return '?'
  if (delay === 0) return '×'
  if (delay >= 1000) return '>1s'
  return String(delay)
}

function getDelaySvgColor(delay: number): string {
  if (delay === -1) return 'var(--color-default)'
  if (delay === 0) return 'var(--color-danger)'
  if (delay < 500) return 'var(--color-success)'
  return 'var(--color-warning)'
}

const ProxyDetailTooltip: React.FC<Props> = ({ proxy, anchorEl, visible }) => {
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
    const clamped = Math.min(pos.top, vh - h - 8)
    setFinalTop(Math.max(8, clamped))
  }, [pos, anchorEl, proxy])

  if (!visible || !pos || !anchorEl) return null

  const isPositioned = finalTop !== null
  const displayTop = finalTop ?? pos.top
  const { side } = pos

  const anchorRect = anchorEl.getBoundingClientRect()
  const anchorMidRelative = anchorRect.top + anchorRect.height / 2 - displayTop
  const tooltipH = panelRef.current?.offsetHeight ?? 120
  const arrowTop = Math.max(10, Math.min(anchorMidRelative - 6, tooltipH - 22))

  const delay = proxy.history.length > 0 ? proxy.history[proxy.history.length - 1].delay : -1

  const history = proxy.history.slice(-8)
  const validDelays = history.filter((h) => h.delay > 0).map((h) => h.delay)
  const maxDelay = validDelays.length > 0 ? Math.max(...validDelays) : 500

  const group = isGroupProxy(proxy) ? proxy : null

  const n = history.length
  const barWidth = Math.min(10, n > 0 ? (SPARK_W - 8) / n - 2 : 10)

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
        <div className="flex items-start justify-between gap-2 px-3 pt-2.5 pb-2">
          <span className="text-xs font-semibold flag-emoji min-w-0 flex-1 whitespace-normal wrap-anywhere leading-5">
            {proxy.name}
          </span>
          <Chip className="shrink-0" color={getDelayChipColor(delay)} variant="soft" size="sm">
            {getDelayText(delay)}
          </Chip>
        </div>

        <Separator className="mx-3 w-auto bg-default-200/70" />

        <div className="px-3 py-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5 items-center">
          <span className="text-[10px] text-muted">类型</span>
          <Chip className="justify-self-end" variant="soft" size="sm">
            {proxy.type}
          </Chip>

          <span className="text-[10px] text-muted">状态</span>
          <Chip
            className="justify-self-end"
            color={proxy.alive ? 'success' : 'danger'}
            variant="soft"
            size="sm"
          >
            {proxy.alive ? '在线' : '离线'}
          </Chip>

          {proxy.udp !== undefined && (
            <>
              <span className="text-[10px] text-muted">UDP</span>
              <Chip
                className="justify-self-end"
                color={proxy.udp ? 'success' : 'default'}
                variant="soft"
                size="sm"
              >
                {proxy.udp ? '开启' : '关闭'}
              </Chip>
            </>
          )}
          {proxy.tfo !== undefined && (
            <>
              <span className="text-[10px] text-muted">TFO</span>
              <Chip
                className="justify-self-end"
                color={proxy.tfo ? 'success' : 'default'}
                variant="soft"
                size="sm"
              >
                {proxy.tfo ? '开启' : '关闭'}
              </Chip>
            </>
          )}
          {proxy.xudp !== undefined && (
            <>
              <span className="text-[10px] text-muted">XUDP</span>
              <Chip
                className="justify-self-end"
                color={proxy.xudp ? 'success' : 'default'}
                variant="soft"
                size="sm"
              >
                {proxy.xudp ? '开启' : '关闭'}
              </Chip>
            </>
          )}
          {proxy.mptcp !== undefined && (
            <>
              <span className="text-[10px] text-muted">MPTCP</span>
              <Chip
                className="justify-self-end"
                color={proxy.mptcp ? 'success' : 'default'}
                variant="soft"
                size="sm"
              >
                {proxy.mptcp ? '开启' : '关闭'}
              </Chip>
            </>
          )}
          {proxy.smux !== undefined && (
            <>
              <span className="text-[10px] text-muted">SING-MUX</span>
              <Chip
                className="justify-self-end"
                color={proxy.smux ? 'success' : 'default'}
                variant="soft"
                size="sm"
              >
                {proxy.smux ? '开启' : '关闭'}
              </Chip>
            </>
          )}
          {proxy.uot !== undefined && (
            <>
              <span className="text-[10px] text-muted">UDP over TCP</span>
              <Chip
                className="justify-self-end"
                color={proxy.uot ? 'success' : 'default'}
                variant="soft"
                size="sm"
              >
                {proxy.uot ? '开启' : '关闭'}
              </Chip>
            </>
          )}
          {proxy.interface && (
            <>
              <span className="text-[10px] text-muted">出站接口</span>
              <span className="text-[10px] text-muted justify-self-end truncate">
                {proxy.interface}
              </span>
            </>
          )}
          {group?.now && !group?.fixed && (
            <>
              <span className="text-[10px] text-muted">当前选择</span>
              <span className="text-[10px] flag-emoji text-muted min-w-0 text-right whitespace-normal wrap-anywhere">
                {group.now}
              </span>
            </>
          )}
          {group?.fixed && (
            <>
              <span className="text-[10px] text-muted">固定选择</span>
              <span className="text-[10px] flag-emoji text-muted min-w-0 text-right whitespace-normal wrap-anywhere">
                {group.fixed}
              </span>
            </>
          )}
        </div>

        <Separator className="mx-3 w-auto bg-default-200/70" />
        <div className="px-3 pt-2 pb-2.5">
          <span className="text-[10px] text-muted block mb-1.5">历史延迟</span>
          {history.length > 0 ? (
            <svg width={SPARK_W} height={CHART_H}>
              {history.map((h, i) => {
                const x = n === 1 ? SPARK_W / 2 : 4 + (i / (n - 1)) * (SPARK_W - 8)
                const barH =
                  h.delay > 0
                    ? Math.max(3, (h.delay / maxDelay) * BAR_H)
                    : h.delay === 0
                      ? BAR_H
                      : 3
                const y = BAR_H - barH
                const isLatest = i === n - 1
                const color = getDelaySvgColor(h.delay)
                return (
                  <g key={i}>
                    <rect
                      x={x - barWidth / 2}
                      y={y}
                      width={barWidth}
                      height={barH}
                      rx={2}
                      fill={color}
                      opacity={isLatest ? 1 : 0.38}
                    />
                    <text
                      x={x}
                      y={BAR_H + LABEL_H - 1}
                      textAnchor="middle"
                      fontSize={isLatest ? 8 : 7}
                      fontFamily="monospace"
                      fill={color}
                      opacity={isLatest ? 1 : 0.55}
                    >
                      {getDelayLabel(h.delay)}
                    </text>
                  </g>
                )
              })}
            </svg>
          ) : (
            <span className="text-[10px] text-muted/50">暂无记录</span>
          )}
        </div>
      </Surface>
    </div>,
    document.body
  )
}

export default ProxyDetailTooltip
