import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { FaCircleArrowDown, FaCircleArrowUp } from 'react-icons/fa6'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import React, { useEffect, useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoLink } from 'react-icons/io5'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { readImageFileDataURL } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import templateTrayIcon from '../../../../../resources/iconTemplate.png'
import TrafficChart from './traffic-chart'

let currentUpload: number | undefined = undefined
let currentDownload: number | undefined = undefined
let currentTrayIcon = ''
let hasShowTraffic = false
let drawing = false

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = (): void => resolve(image)
    image.onerror = (): void => reject(new Error('Failed to load the tray icon'))
    image.src = url
  })
}

interface Props {
  iconOnly?: boolean
}

const ConnCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const { appConfig } = useAppConfig()
  const {
    showTraffic = false,
    customTrayIcon = '',
    connectionCardStatus = 'col-span-2',
    disableAnimation = false
  } = appConfig || {}
  const showTrafficRef = useRef(showTraffic)
  showTrafficRef.current = showTraffic
  const customTrayIconRef = useRef(customTrayIcon)
  customTrayIconRef.current = customTrayIcon

  const location = useLocation()
  const navigate = useNavigate()
  const match = location.pathname.includes('/connections')

  const [upload, setUpload] = useState(0)
  const [download, setDownload] = useState(0)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: 'connection'
  })
  const [trafficData, setTrafficData] = useState(() =>
    Array(10)
      .fill(0)
      .map((v, i) => ({ traffic: v, index: i }))
  )
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null

  useEffect(() => {
    const handleTraffic = async (_e: unknown, info: ControllerTraffic): Promise<void> => {
      setUpload(info.up)
      setDownload(info.down)

      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      updateTimeoutRef.current = setTimeout(() => {
        setTrafficData((prev) => {
          const newData = [...prev]
          newData.shift()
          newData.push({ traffic: info.up + info.down, index: Date.now() })
          return newData
        })
        updateTimeoutRef.current = null
      }, 100)

      if (platform === 'darwin' && showTrafficRef.current) {
        if (drawing) return
        drawing = true
        try {
          await drawTrayTrafficIcon(info.up, info.down, customTrayIconRef.current)
          hasShowTraffic = true
        } catch {
          // ignore
        } finally {
          drawing = false
        }
      } else {
        if (!hasShowTraffic) return
        currentUpload = undefined
        currentDownload = undefined
        currentTrayIcon = ''
        window.electron.ipcRenderer.send('trayIconUpdate')
        hasShowTraffic = false
      }
    }

    window.electron.ipcRenderer.on('mihomoTraffic', handleTraffic)

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('mihomoTraffic')
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
    }
  }, [])

  if (iconOnly) {
    return (
      <div className={`${connectionCardStatus} flex justify-center`}>
        <Tooltip content="连接" placement="right">
          <Button
            size="sm"
            isIconOnly
            color={match ? 'primary' : 'default'}
            variant={match ? 'solid' : 'light'}
            onPress={() => {
              navigate('/connections')
            }}
          >
            <IoLink className="text-[20px]" />
          </Button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
      className={`${connectionCardStatus} conn-card`}
    >
      {connectionCardStatus === 'col-span-2' ? (
        <>
          <Card
            fullWidth
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''} relative overflow-hidden`}
          >
            <CardBody className="pb-1 pt-0 px-0 overflow-y-visible">
              <div className="flex justify-between">
                <Button
                  isIconOnly
                  className="bg-transparent pointer-events-none"
                  variant="flat"
                  color="default"
                >
                  <IoLink
                    color="default"
                    className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px]`}
                  />
                </Button>
                <div
                  className={`p-2 w-full ${match ? 'text-primary-foreground' : 'text-foreground'} `}
                >
                  <div className="flex justify-between">
                    <div className="w-full text-right mr-2">{calcTraffic(upload)}/s</div>
                    <FaCircleArrowUp className="h-6 leading-6" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-full text-right mr-2">{calcTraffic(download)}/s</div>
                    <FaCircleArrowDown className="h-6 leading-6" />
                  </div>
                </div>
              </div>
            </CardBody>
            <CardFooter className="pt-1 relative z-10">
              <div
                className={`flex justify-between items-center w-full text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <h3>连接</h3>
              </div>
            </CardFooter>
            <TrafficChart data={trafficData} isActive={match} />
          </Card>
        </>
      ) : (
        <Card
          fullWidth
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className={`${match ? 'bg-primary' : 'hover:bg-primary/30'} ${isDragging ? `${disableAnimation ? '' : 'scale-[0.95]'} tap-highlight-transparent` : ''}`}
        >
          <CardBody className="pb-1 pt-0 px-0 overflow-y-visible">
            <div className="flex justify-between">
              <Button
                isIconOnly
                className="bg-transparent pointer-events-none"
                variant="flat"
                color="default"
              >
                <IoLink
                  color="default"
                  className={`${match ? 'text-primary-foreground' : 'text-foreground'} text-[24px] font-bold`}
                />
              </Button>
            </div>
          </CardBody>
          <CardFooter className="pt-1">
            <h3
              className={`text-md font-bold ${match ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              连接
            </h3>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

export default React.memo(ConnCard, (prevProps, nextProps) => {
  return prevProps.iconOnly === nextProps.iconOnly
})

const drawTrayTrafficIcon = async (
  upload: number,
  download: number,
  customTrayIcon: string
): Promise<void> => {
  const trayIconKey = customTrayIcon || 'default'
  if (upload === currentUpload && download === currentDownload && trayIconKey === currentTrayIcon) {
    return
  }

  const uploadText = `${calcTraffic(upload)}/s`
  const downloadText = `${calcTraffic(download)}/s`
  const trayIcon = await loadImage(
    customTrayIcon && !customTrayIcon.startsWith('data:image/')
      ? await readImageFileDataURL(customTrayIcon)
      : customTrayIcon || templateTrayIcon
  )

  const canvas = document.createElement('canvas')
  canvas.width = 172
  canvas.height = 36
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to create the tray icon canvas')

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.font = 'bold 18px "PingFang SC", Arial'
  ctx.fillStyle = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'white' : 'black'
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText('↑', 0, 15)
  ctx.fillText('↓', 0, 34)
  ctx.textAlign = 'right'
  ctx.fillText(uploadText, 116, 15)
  ctx.fillText(downloadText, 116, 34)
  ctx.drawImage(trayIcon, 128, 0, 36, 36)

  window.electron.ipcRenderer.send('trayIconUpdate', canvas.toDataURL('image/png'))
  currentUpload = upload
  currentDownload = download
  currentTrayIcon = trayIconKey
}
