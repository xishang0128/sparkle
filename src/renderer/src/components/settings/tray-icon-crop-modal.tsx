import { Button, FieldError, Input, Label, Modal, Slider, Tabs, TextField } from '@heroui/react'
import {
  cropImageElementToPngDataURL,
  type ImageColorPreset,
  type ImageRgbColor
} from '@renderer/utils/image'
import React, { useEffect, useRef, useState, type CSSProperties } from 'react'

interface Props {
  imageDataURL: string
  onCancel: () => void
  onConfirm: (imageDataURL: string) => void
}

interface ImageSize {
  width: number
  height: number
}

interface Crop {
  x: number
  y: number
  size: number
}

interface DragState {
  type: 'move' | 'resize'
  clientX: number
  clientY: number
  crop: Crop
}

const maxOutputSize = 1024
const minCropSizeRatio = 0.05
const defaultCornerRadiusPercent = 12
const defaultRgbColor: ImageRgbColor = { red: 255, green: 255, blue: 255 }
type ColorMode = ImageColorPreset | 'custom'

const colorModeOptions: { id: ColorMode; label: string; previewFilter: string }[] = [
  { id: 'original', label: '原图', previewFilter: 'none' },
  { id: 'vivid', label: '鲜艳', previewFilter: 'saturate(1.55) contrast(1.12)' },
  { id: 'grayscale', label: '灰度', previewFilter: 'grayscale(1)' },
  { id: 'monochrome', label: '黑白', previewFilter: 'grayscale(1) contrast(1000%)' },
  { id: 'warm', label: '暖色', previewFilter: 'sepia(0.18) saturate(1.2) brightness(1.04)' },
  {
    id: 'cool',
    label: '冷色',
    previewFilter: 'saturate(1.08) hue-rotate(185deg) brightness(1.03)'
  },
  { id: 'sepia', label: '复古', previewFilter: 'sepia(0.85) saturate(1.08)' },
  { id: 'highContrast', label: '高对比', previewFilter: 'contrast(1.42)' },
  { id: 'soft', label: '柔和', previewFilter: 'contrast(0.9) brightness(1.06) saturate(0.92)' },
  { id: 'invert', label: '反色', previewFilter: 'invert(1)' },
  { id: 'custom', label: '自定义', previewFilter: 'url(#tray-icon-rgb-filter)' }
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getSliderNumber(value: number | number[]): number {
  return Array.isArray(value) ? value[0] : value
}

function formatRgbColor(rgbColor: ImageRgbColor): string {
  return `[${rgbColor.red}, ${rgbColor.green}, ${rgbColor.blue}]`
}

function parseRgbColor(value: string): ImageRgbColor | undefined {
  const values = value.match(/-?\d+/g)?.map(Number)
  if (!values || values.length !== 3 || values.some((item) => item < 0 || item > 255)) {
    return undefined
  }

  const [red, green, blue] = values
  return { red, green, blue }
}

function getRoundedCornerHandlePosition(radiusPercent: number): number {
  if (radiusPercent <= 0) return 100

  return 100 - radiusPercent + radiusPercent / Math.SQRT2
}

function getSvgColorMatrixValue(rgbColor: ImageRgbColor): string {
  const red = rgbColor.red / 255
  const green = rgbColor.green / 255
  const blue = rgbColor.blue / 255

  return [`${red} 0 0 0 0`, `0 ${green} 0 0 0`, `0 0 ${blue} 0 0`, '0 0 0 1 0'].join(' ')
}

const TrayIconCropModal: React.FC<Props> = (props) => {
  const { imageDataURL, onCancel, onConfirm } = props
  const wrapperRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageSize, setImageSize] = useState<ImageSize>()
  const [crop, setCrop] = useState<Crop>()
  const [drag, setDrag] = useState<DragState>()
  const [cornerRadiusPercent, setCornerRadiusPercent] = useState(defaultCornerRadiusPercent)
  const [colorMode, setColorMode] = useState<ColorMode>('original')
  const [rgbColor, setRgbColor] = useState<ImageRgbColor>(defaultRgbColor)
  const [rgbText, setRgbText] = useState(formatRgbColor(defaultRgbColor))

  useEffect(() => {
    setImageSize(undefined)
    setCrop(undefined)
    setDrag(undefined)
    setCornerRadiusPercent(defaultCornerRadiusPercent)
    setColorMode('original')
    setRgbColor(defaultRgbColor)
    setRgbText(formatRgbColor(defaultRgbColor))
  }, [imageDataURL])

  const getImageDelta = (clientX: number, clientY: number): { dx: number; dy: number } => {
    const rect = imageRef.current?.getBoundingClientRect()
    if (!rect || !imageSize || !drag) return { dx: 0, dy: 0 }

    return {
      dx: ((clientX - drag.clientX) / rect.width) * imageSize.width,
      dy: ((clientY - drag.clientY) / rect.height) * imageSize.height
    }
  }

  const handleImageLoad = (): void => {
    const image = imageRef.current
    if (!image) return

    const nextImageSize = {
      width: image.naturalWidth,
      height: image.naturalHeight
    }
    const size = Math.min(nextImageSize.width, nextImageSize.height)

    setImageSize(nextImageSize)
    setCrop({
      x: (nextImageSize.width - size) / 2,
      y: (nextImageSize.height - size) / 2,
      size
    })
  }

  const getMinCropSize = (): number => {
    if (!imageSize) return 1

    return Math.max(1, Math.min(imageSize.width, imageSize.height) * minCropSizeRatio)
  }

  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    type: DragState['type']
  ): void => {
    if (!crop) return

    wrapperRef.current?.setPointerCapture(e.pointerId)
    setDrag({
      type,
      clientX: e.clientX,
      clientY: e.clientY,
      crop
    })
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!drag || !imageSize) return

    const { dx, dy } = getImageDelta(e.clientX, e.clientY)
    if (drag.type === 'resize') {
      const maxSize = Math.min(imageSize.width - drag.crop.x, imageSize.height - drag.crop.y)

      setCrop({
        ...drag.crop,
        size: clamp(drag.crop.size + Math.max(dx, dy), getMinCropSize(), maxSize)
      })
      return
    }

    setCrop({
      ...drag.crop,
      x: clamp(drag.crop.x + dx, 0, imageSize.width - drag.crop.size),
      y: clamp(drag.crop.y + dy, 0, imageSize.height - drag.crop.size)
    })
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
    setDrag(undefined)
  }

  const handleConfirm = (): void => {
    const image = imageRef.current
    if (!image || !crop) return

    const dataURL = cropImageElementToPngDataURL(image, crop, {
      maxOutputSize,
      cornerRadiusPercent,
      colorPreset: colorMode === 'custom' ? 'original' : colorMode,
      rgbColor: colorMode === 'custom' ? rgbColor : undefined
    })
    if (dataURL) {
      onConfirm(dataURL)
    }
  }

  const cropStyle =
    imageSize && crop
      ? {
          left: `${(crop.x / imageSize.width) * 100}%`,
          top: `${(crop.y / imageSize.height) * 100}%`,
          width: `${(crop.size / imageSize.width) * 100}%`,
          height: `${(crop.size / imageSize.height) * 100}%`
        }
      : undefined
  const cropRadiusStyle = cropStyle
    ? {
        ...cropStyle,
        borderRadius: `${cornerRadiusPercent}%`
      }
    : undefined
  const roundedCornerHandlePosition = getRoundedCornerHandlePosition(cornerRadiusPercent)
  const resizeHandleStyle = cropRadiusStyle
    ? ({
        left: `${roundedCornerHandlePosition}%`,
        top: `${roundedCornerHandlePosition}%`
      } satisfies CSSProperties)
    : undefined
  const previewFilter =
    colorModeOptions.find((option) => option.id === colorMode)?.previewFilter || 'none'
  const imageMaxHeight =
    colorMode === 'custom' ? 'min(50vh, calc(100vh - 500px))' : 'min(50vh, calc(100vh - 450px))'
  const rgbTextInvalid = colorMode === 'custom' && !parseRgbColor(rgbText)
  const setRgbChannel = (channel: keyof ImageRgbColor, value: number | number[]): void => {
    const nextRgbColor = { ...rgbColor, [channel]: getSliderNumber(value) }
    setRgbColor(nextRgbColor)
    setRgbText(formatRgbColor(nextRgbColor))
  }
  const handleRgbTextChange = (value: string): void => {
    setRgbText(value)

    const nextRgbColor = parseRgbColor(value)
    if (nextRgbColor) {
      setRgbColor(nextRgbColor)
    }
  }

  return (
    <Modal>
      <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
        <filter id="tray-icon-rgb-filter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={getSvgColorMatrixValue(rgbColor)} />
        </filter>
      </svg>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onCancel}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container>
          <Modal.Dialog className="tray-icon-crop-modal w-fit max-w-[calc(100vw-64px)] max-h-[calc(100vh-80px)]">
            <Modal.Header className="app-drag">
              <Modal.Heading>裁剪托盘图标</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="flex w-fit flex-col items-center gap-3 p-2">
                <div
                  ref={wrapperRef}
                  className="relative inline-block max-w-[calc(100vw-176px)] touch-none select-none overflow-visible leading-none"
                  style={{ maxHeight: imageMaxHeight }}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                >
                  <img
                    ref={imageRef}
                    src={imageDataURL}
                    className="block max-w-[calc(100vw-176px)] rounded-none object-contain"
                    draggable={false}
                    onLoad={handleImageLoad}
                    style={{ filter: previewFilter, maxHeight: imageMaxHeight }}
                  />
                  {cropRadiusStyle && (
                    <>
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div
                          className="absolute rounded-none shadow-[0_0_0_9999px_rgba(0,0,0,0.34)]"
                          style={cropRadiusStyle}
                        />
                      </div>
                      <div
                        className="absolute cursor-move rounded-none border-2 border-primary ring-1 ring-background/80"
                        style={cropRadiusStyle}
                        onPointerDown={(e) => handlePointerDown(e, 'move')}
                      >
                        <div
                          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-background bg-primary shadow-sm"
                          style={resizeHandleStyle}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            handlePointerDown(e, 'resize')
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex w-full min-w-72 flex-col gap-3 border-t border-default-200 pt-3">
                  <Slider
                    aria-label="圆角"
                    className="w-full"
                    minValue={0}
                    maxValue={50}
                    step={1}
                    value={cornerRadiusPercent}
                    onChange={(value) => setCornerRadiusPercent(getSliderNumber(value))}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <Label className="text-xs text-default-600">圆角</Label>
                      <Slider.Output className="text-xs text-default-500">
                        {`${cornerRadiusPercent}%`}
                      </Slider.Output>
                    </div>
                    <Slider.Track>
                      <Slider.Fill />
                      <Slider.Thumb />
                    </Slider.Track>
                  </Slider>
                  <div className="flex w-full flex-col gap-2">
                    <Label className="text-xs text-default-600">样式</Label>
                    <Tabs
                      data-size="sm"
                      selectedKey={colorMode}
                      onSelectionChange={(key) => setColorMode(String(key) as ColorMode)}
                    >
                      <Tabs.ListContainer>
                        <Tabs.List aria-label="色彩预设">
                          {colorModeOptions.map((option) => (
                            <Tabs.Tab key={option.id} id={option.id}>
                              {option.label}
                              <Tabs.Indicator />
                            </Tabs.Tab>
                          ))}
                        </Tabs.List>
                      </Tabs.ListContainer>
                    </Tabs>
                    {colorMode === 'custom' && (
                      <div className="flex items-center gap-2 pt-1">
                        <div
                          className="h-7 w-7 shrink-0 rounded-full border border-default-300"
                          style={{
                            backgroundColor: `rgb(${rgbColor.red}, ${rgbColor.green}, ${rgbColor.blue})`
                          }}
                        />
                        <TextField
                          aria-label="RGB 数组"
                          className="w-28 shrink-0"
                          isInvalid={rgbTextInvalid}
                          value={rgbText}
                          onChange={handleRgbTextChange}
                        >
                          <Label className="sr-only">RGB 数组</Label>
                          <Input className="h-7 text-xs" />
                          {rgbTextInvalid && <FieldError>请输入 [0-255, 0-255, 0-255]</FieldError>}
                        </TextField>
                        <Slider
                          aria-label="R"
                          minValue={0}
                          maxValue={255}
                          step={1}
                          value={rgbColor.red}
                          onChange={(value) => setRgbChannel('red', value)}
                          className="min-w-0 flex-1"
                        >
                          <Label className="text-xs text-red-500">R {rgbColor.red}</Label>
                          <Slider.Track>
                            <Slider.Fill style={{ backgroundColor: '#ef4444' }} />
                            <Slider.Thumb
                              style={{ backgroundColor: '#ef4444', borderColor: '#ef4444' }}
                            />
                          </Slider.Track>
                        </Slider>
                        <Slider
                          aria-label="G"
                          minValue={0}
                          maxValue={255}
                          step={1}
                          value={rgbColor.green}
                          onChange={(value) => setRgbChannel('green', value)}
                          className="min-w-0 flex-1"
                        >
                          <Label className="text-xs text-green-500">G {rgbColor.green}</Label>
                          <Slider.Track>
                            <Slider.Fill style={{ backgroundColor: '#22c55e' }} />
                            <Slider.Thumb
                              style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                            />
                          </Slider.Track>
                        </Slider>
                        <Slider
                          aria-label="B"
                          minValue={0}
                          maxValue={255}
                          step={1}
                          value={rgbColor.blue}
                          onChange={(value) => setRgbChannel('blue', value)}
                          className="min-w-0 flex-1"
                        >
                          <Label className="text-xs text-blue-500">B {rgbColor.blue}</Label>
                          <Slider.Track>
                            <Slider.Fill style={{ backgroundColor: '#3b82f6' }} />
                            <Slider.Thumb
                              style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6' }}
                            />
                          </Slider.Track>
                        </Slider>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer className="pt-0">
              <Button size="sm" variant="secondary" onPress={onCancel}>
                取消
              </Button>
              <Button size="sm" isDisabled={!crop} onPress={handleConfirm}>
                确认
              </Button>
            </Modal.Footer>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default TrayIconCropModal
