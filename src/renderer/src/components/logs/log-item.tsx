import { Card, CardBody, CardHeader } from '@heroui/react'
import React, { useEffect, useState } from 'react'

const colorMap: Record<LogLevel, string> = {
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-primary',
  debug: 'text-default-500',
  silent: 'text-default-500'
}

interface Props extends ControllerLog {
  index: number
  animateOnMount?: boolean
}

const LogItemComponent: React.FC<Props> = (props) => {
  const { type, payload, time, index, animateOnMount = false } = props
  const [entered, setEntered] = useState(!animateOnMount)

  useEffect(() => {
    if (!animateOnMount) {
      setEntered(true)
      return
    }

    setEntered(false)
    const frame = window.requestAnimationFrame(() => {
      setEntered(true)
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [animateOnMount])

  return (
    <div
      className={`px-2 pb-2 transition-[opacity,transform] duration-300 ease-out ${
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${index === 0 ? 'pt-2' : ''}`}
    >
      <Card className={animateOnMount ? 'ring-1 ring-primary/12' : ''}>
        <CardHeader className="pb-0 pt-1">
          <div className={`mr-2 text-lg font-bold ${colorMap[type]}`}>
            {props.type.toUpperCase()}
          </div>
          <small className="text-foreground-500">{time}</small>
        </CardHeader>
        <CardBody className="select-text pt-0 text-sm">{payload}</CardBody>
      </Card>
    </div>
  )
}

const LogItem = React.memo(LogItemComponent)

export default LogItem
