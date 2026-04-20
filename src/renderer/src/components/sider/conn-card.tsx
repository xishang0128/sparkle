import { Button, Card, CardBody, CardFooter, Tooltip } from '@heroui/react'
import { FaCircleArrowDown, FaCircleArrowUp } from 'react-icons/fa6'
import { useLocation, useNavigate } from 'react-router-dom'
import { calcTraffic } from '@renderer/utils/calc'
import React, { useEffect, useState, useRef } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IoLink } from 'react-icons/io5'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import TrafficChart from './traffic-chart'

let currentUpload: number | undefined = undefined
let currentDownload: number | undefined = undefined
let hasShowTraffic = false
let drawing = false

interface Props {
  iconOnly?: boolean
}

const ConnCard: React.FC<Props> = (props) => {
  const { iconOnly } = props
  const { appConfig } = useAppConfig()
  const {
    showTraffic = false,
    connectionCardStatus = 'col-span-2',
    disableAnimation = false
  } = appConfig || {}
  const showTrafficRef = useRef(showTraffic)
  showTrafficRef.current = showTraffic

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
          await drawTrayTrafficIcon(info.up, info.down)
          hasShowTraffic = true
        } catch {
          // ignore
        } finally {
          drawing = false
        }
      } else {
        if (!hasShowTraffic) return
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

const drawTrayTrafficIcon = async (upload: number, download: number): Promise<void> => {
  if (upload === currentUpload && download === currentDownload) return
  currentUpload = upload
  currentDownload = download

  const uploadText = `${calcTraffic(upload)}/s`
  const downloadText = `${calcTraffic(download)}/s`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 118 36"><text x="0" y="15" font-size="18" font-family="PingFang SC, Arial" font-weight="bold">↑</text><text x="118" y="15" font-size="18" font-family="PingFang SC, Arial" font-weight="bold" text-anchor="end">${uploadText}</text><text x="0" y="34" font-size="18" font-family="PingFang SC, Arial" font-weight="bold">↓</text><text x="118" y="34" font-size="18" font-family="PingFang SC, Arial" font-weight="bold" text-anchor="end">${downloadText}</text></svg>`
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  const image = await loadImage(url)
  window.electron.ipcRenderer.send('trayIconUpdate', image)
}

const loadImage = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = (): void => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = 118
      canvas.height = 36
      ctx?.drawImage(img, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = (): void => {
      reject()
    }
    img.src = url
  })
}
