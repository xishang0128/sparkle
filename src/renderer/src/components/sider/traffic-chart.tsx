import React, { useMemo } from 'react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

export interface TrafficChartProps {
  data: Array<{ traffic: number; index: number }>
  isActive: boolean
}

const TrafficChart: React.FC<TrafficChartProps> = (props) => {
  const { data, isActive } = props

  const gradientId = useMemo(
    () => `traffic-gradient-${isActive ? 'active' : 'inactive'}`,
    [isActive]
  )

  const validData = useMemo(() => {
    if (!data || data.length === 0) {
      return Array(10)
        .fill(0)
        .map((v, i) => ({ traffic: v, index: i }))
    }
    return data.slice()
  }, [data])

  const chartColor = useMemo(() => {
    return isActive ? 'hsl(var(--heroui-primary-foreground))' : 'hsl(var(--heroui-foreground))'
  }, [isActive])

  return (
    <ResponsiveContainer
      height="100%"
      width="100%"
      className="absolute top-0 left-0 pointer-events-none rounded-[14px]"
    >
      <AreaChart data={validData} margin={{ top: 50, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity={0.8} />
            <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="traffic"
          stroke="none"
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default React.memo(TrafficChart, (prevProps, nextProps) => {
  return (
    prevProps.isActive === nextProps.isActive &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  )
})
