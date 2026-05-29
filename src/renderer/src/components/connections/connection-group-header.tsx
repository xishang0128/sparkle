import { Button, Card, CardBody, Chip } from '@heroui/react'
import { Avatar } from '@heroui-v3/react'
import { calcTraffic } from '@renderer/utils/calc'
import React, { memo, useMemo } from 'react'
import { CgClose, CgTrash } from 'react-icons/cg'
import { IoIosArrowBack } from 'react-icons/io'

interface Props {
  groupKey: string
  label: string
  count: number
  upload: number
  download: number
  uploadSpeed: number
  downloadSpeed: number
  expanded: boolean
  isLast: boolean
  isClosed?: boolean
  displayIcon?: boolean
  iconUrl?: string
  displayName?: string
  onToggle: (key: string, currentlyOpen: boolean) => void
  onCloseAll: (key: string) => void
}

const ConnectionGroupHeaderComponent: React.FC<Props> = ({
  groupKey,
  label,
  count,
  upload,
  download,
  uploadSpeed,
  downloadSpeed,
  expanded,
  isLast,
  isClosed,
  displayIcon,
  iconUrl,
  displayName,
  onToggle,
  onCloseAll
}) => {
  const title = useMemo(() => {
    if (displayName) return displayName
    const name = label.replace(/\.exe$/, '')
    return name || '未知进程'
  }, [displayName, label])

  const uploadTraffic = useMemo(() => calcTraffic(upload), [upload])
  const downloadTraffic = useMemo(() => calcTraffic(download), [download])
  const hasSpeed = uploadSpeed > 0 || downloadSpeed > 0
  const uploadSpeedText = useMemo(() => calcTraffic(uploadSpeed), [uploadSpeed])
  const downloadSpeedText = useMemo(() => calcTraffic(downloadSpeed), [downloadSpeed])

  return (
    <div className={`w-full pt-2 ${isLast && !expanded ? 'pb-2' : ''} px-2`}>
      <Card as="div" isPressable fullWidth onPress={() => onToggle(groupKey, expanded)}>
        <CardBody className="w-full h-16 p-0">
          <div className="flex justify-between items-center h-full pl-2 pr-3">
            <div className="flex items-center overflow-hidden whitespace-nowrap h-full min-w-0">
              {displayIcon && (
                <Avatar size="lg" className="mr-2 h-12 w-12 shrink-0 bg-transparent">
                  <Avatar.Image className="object-contain" src={iconUrl} />
                </Avatar>
              )}
              <div className="flex flex-col justify-center gap-1 min-w-0 py-2">
                <div className="text-md text-ellipsis overflow-hidden whitespace-nowrap leading-snug">
                  {title}
                </div>
                <div className="text-xs text-foreground-500 leading-snug whitespace-nowrap text-ellipsis overflow-hidden">
                  <span>
                    ↑ {uploadTraffic} ↓ {downloadTraffic}
                  </span>
                  {hasSpeed && (
                    <span className="ml-2 text-primary">
                      ↑ {uploadSpeedText}/s ↓ {downloadSpeedText}/s
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center shrink-0">
              <Chip size="sm" className="my-1 mr-1">
                {count}
              </Chip>
              <div
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Button
                  variant="light"
                  size="sm"
                  isIconOnly
                  color={isClosed ? 'danger' : 'warning'}
                  aria-label={isClosed ? '清空该进程全部记录' : '关闭该进程全部连接'}
                  onPress={() => onCloseAll(groupKey)}
                >
                  {isClosed ? <CgTrash className="text-lg" /> : <CgClose className="text-lg" />}
                </Button>
              </div>
              <IoIosArrowBack
                className={`transition duration-200 ml-1 h-8 text-lg text-foreground-500 flex items-center ${
                  expanded ? '-rotate-90' : ''
                }`}
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

const ConnectionGroupHeader = memo(ConnectionGroupHeaderComponent, (prev, next) => {
  return (
    prev.groupKey === next.groupKey &&
    prev.label === next.label &&
    prev.count === next.count &&
    prev.upload === next.upload &&
    prev.download === next.download &&
    prev.uploadSpeed === next.uploadSpeed &&
    prev.downloadSpeed === next.downloadSpeed &&
    prev.expanded === next.expanded &&
    prev.isLast === next.isLast &&
    prev.isClosed === next.isClosed &&
    prev.displayIcon === next.displayIcon &&
    prev.iconUrl === next.iconUrl &&
    prev.displayName === next.displayName
  )
})

export default ConnectionGroupHeader
