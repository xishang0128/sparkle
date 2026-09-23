import { Button, Separator } from '@heroui/react'

import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { isAlwaysOnTop, setAlwaysOnTop } from '@renderer/utils/ipc'
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { RiPushpin2Fill, RiPushpin2Line } from 'react-icons/ri'
interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
}

interface WindowControlsOverlay extends EventTarget {
  visible: boolean
  getTitlebarAreaRect: () => DOMRect
}

let saveOnTop = false

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { appConfig } = useAppConfig()
  const { useWindowFrame = false, disableAnimation = false } = appConfig || {}
  const [overlayWidth, setOverlayWidth] = React.useState(0)
  const [onTop, setOnTop] = useState(saveOnTop)

  const updateAlwaysOnTop = async (): Promise<void> => {
    setOnTop(await isAlwaysOnTop())
    saveOnTop = await isAlwaysOnTop()
  }

  useEffect(() => {
    const overlay = (
      window.navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlay }
    ).windowControlsOverlay

    if (platform === 'darwin' || useWindowFrame || !overlay) {
      setOverlayWidth(0)
      return
    }

    const updateOverlayWidth = (): void => {
      const rect = overlay.getTitlebarAreaRect()
      // The overlay can report an empty rectangle before the window is shown.
      setOverlayWidth(
        overlay.visible && rect.width > 0 ? Math.max(0, window.innerWidth - rect.right) : 0
      )
    }

    updateOverlayWidth()
    overlay.addEventListener('geometrychange', updateOverlayWidth)
    return () => overlay.removeEventListener('geometrychange', updateOverlayWidth)
  }, [useWindowFrame])

  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  return (
    <div ref={contentRef} className="w-full h-full">
      <div
        className={`sticky top-0 h-12.25 w-full ${disableAnimation ? 'bg-background/95 backdrop-blur-sm' : 'bg-transparent backdrop-blur'}`}
      >
        <div className="app-drag p-2 flex justify-between h-12 items-center">
          <div className="title min-w-0 truncate h-full text-lg leading-8">{props.title}</div>
          <div
            style={{ marginRight: overlayWidth }}
            className="header flex shrink-0 gap-1 h-full items-center"
          >
            {props.header}
            <Button
              data-react-aria-top-layer="true"
              style={{ zIndex: 60 }}
              size="sm"
              isIconOnly
              onPress={async () => {
                await setAlwaysOnTop(!onTop)
                await updateAlwaysOnTop()
              }}
              variant="ghost"
              data-color={onTop ? 'primary' : 'default'}
              className="app-nodrag relative"
            >
              {onTop ? (
                <RiPushpin2Fill className="text-lg" />
              ) : (
                <RiPushpin2Line className="text-lg" />
              )}
            </Button>
          </div>
        </div>

        <Separator />
      </div>
      <div
        className={`content h-[calc(100vh-49px)] overflow-y-auto custom-scrollbar ${props.contentClassName ?? ''}`}
      >
        {props.children}
      </div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
