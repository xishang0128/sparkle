import React, { useId, useMemo } from 'react'

export interface TrafficChartProps {
  data: Array<{ traffic: number; index: number }>
  isActive: boolean
}

interface Point {
  x: number
  y: number
}

function sign(value: number): number {
  return value < 0 ? -1 : 1
}

// Steffen monotone interpolation, matching the curve used by Recharts for `type="monotone"`.
function createMonotoneAreaPath(values: number[]): string {
  const maxTraffic = Math.max(...values, 1)
  const points: Point[] = values.map((traffic, index) => ({
    x: (index / (values.length - 1)) * 100,
    y: 100 - (traffic / maxTraffic) * 50
  }))
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L 100 100 L 0 100 Z`
  }
  const slopes = points.slice(1).map((point, index) => {
    const previous = points[index]
    return (point.y - previous.y) / (point.x - previous.x)
  })
  const tangents = points.map((_, index) => {
    if (index === 0 || index === points.length - 1) return 0

    const previousWidth = points[index].x - points[index - 1].x
    const nextWidth = points[index + 1].x - points[index].x
    const previousSlope = slopes[index - 1]
    const nextSlope = slopes[index]
    const weightedSlope =
      (previousSlope * nextWidth + nextSlope * previousWidth) / (previousWidth + nextWidth)
    return (
      (sign(previousSlope) + sign(nextSlope)) *
        Math.min(Math.abs(previousSlope), Math.abs(nextSlope), 0.5 * Math.abs(weightedSlope)) || 0
    )
  })
  tangents[0] = (3 * slopes[0] - tangents[1]) / 2
  tangents[tangents.length - 1] =
    (3 * slopes[slopes.length - 1] - tangents[tangents.length - 2]) / 2
  const curve = points
    .slice(1)
    .map((point, index) => {
      const previous = points[index]
      const width = point.x - previous.x
      return [
        'C',
        previous.x + width / 3,
        previous.y + (tangents[index] * width) / 3,
        point.x - width / 3,
        point.y - (tangents[index + 1] * width) / 3,
        point.x,
        point.y
      ].join(' ')
    })
    .join(' ')

  return `M ${points[0].x} ${points[0].y} ${curve} L 100 100 L 0 100 Z`
}

const TrafficChart: React.FC<TrafficChartProps> = (props) => {
  const { data, isActive } = props
  const id = useId()

  const areaPath = useMemo(() => {
    const values = data.length > 1 ? data.map(({ traffic }) => traffic) : [0, 0]
    return createMonotoneAreaPath(values)
  }, [data])

  const gradientId = `traffic-gradient-${id.replaceAll(':', '')}`
  const chartColor = isActive
    ? 'hsl(var(--heroui-primary-foreground))'
    : 'hsl(var(--heroui-foreground))'

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute top-0 left-0 pointer-events-none rounded-[14px]"
      width="100%"
      height="100%"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={chartColor} stopOpacity={0.8} />
          <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} />
    </svg>
  )
}

export default React.memo(TrafficChart)
