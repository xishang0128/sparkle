import {
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type MouseSensorOptions,
  type TouchSensorOptions
} from '@dnd-kit/core'
import type { MouseEvent, TouchEvent } from 'react'

const noDndSelector = 'button, input, textarea, select, a, [data-no-dnd]'

function shouldHandleEvent(event: Event): boolean {
  const target = event.target

  if (!(target instanceof HTMLElement)) return true
  return !target.closest(noDndSelector)
}

class CardMouseSensor extends MouseSensor {
  static activators = [
    {
      eventName: 'onMouseDown' as const,
      handler: (event: MouseEvent, options: MouseSensorOptions): boolean => {
        return (
          shouldHandleEvent(event.nativeEvent) && MouseSensor.activators[0].handler(event, options)
        )
      }
    }
  ]
}

class CardTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: 'onTouchStart' as const,
      handler: (event: TouchEvent, options: TouchSensorOptions): boolean => {
        return (
          shouldHandleEvent(event.nativeEvent) && TouchSensor.activators[0].handler(event, options)
        )
      }
    }
  ]
}

interface CardDndSensorOptions {
  mouseDistance?: number
  touchDelay?: number
  touchTolerance?: number
}

export function useCardDndSensors(options: CardDndSensorOptions = {}) {
  const { mouseDistance = 4, touchDelay = 180, touchTolerance = 8 } = options

  return useSensors(
    useSensor(CardMouseSensor, {
      activationConstraint: {
        distance: mouseDistance
      }
    }),
    useSensor(CardTouchSensor, {
      activationConstraint: {
        delay: touchDelay,
        tolerance: touchTolerance
      }
    })
  )
}
