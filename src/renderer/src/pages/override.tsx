import { Button, InputGroup, Spinner, Separator, Dropdown, Label } from '@heroui/react'

import BasePage from '@renderer/components/base/base-page'
import { getFilePath, readTextFile } from '@renderer/utils/ipc'
import { useEffect, useRef, useState } from 'react'
import { MdContentPaste } from 'react-icons/md'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import OverrideItem from '@renderer/components/override/override-item'
import EditInfoModal from '@renderer/components/override/edit-info-modal'
import { FaPlus } from 'react-icons/fa6'
import { HiOutlineDocumentText } from 'react-icons/hi'
import { RiArchiveLine } from 'react-icons/ri'
import { useCardDndSensors } from '@renderer/hooks/use-card-dnd-sensors'
import { notify } from '@renderer/utils/notification'

const emptyItems: OverrideItem[] = []

const Override: React.FC = () => {
  const {
    overrideConfig,
    setOverrideConfig,
    addOverrideItem,
    updateOverrideItem,
    removeOverrideItem,
    mutateOverrideConfig
  } = useOverrideConfig()
  const { items } = overrideConfig || {}
  const itemsArray = items ?? emptyItems
  const [sortedItems, setSortedItems] = useState(itemsArray)
  const [importing, setImporting] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [url, setUrl] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState<OverrideItem | null>(null)
  const sensors = useCardDndSensors()
  const isProcessingDrop = useRef(false)
  const handleImport = async (): Promise<void> => {
    setImporting(true)
    try {
      const urlObj = new URL(url)
      const name = urlObj.pathname.split('/').pop()
      await addOverrideItem({
        name: name ? decodeURIComponent(name) : undefined,
        type: 'remote',
        url,
        ext: urlObj.pathname.endsWith('.js') ? 'js' : 'yaml'
      })
    } finally {
      setImporting(false)
    }
  }
  const pageRef = useRef<HTMLDivElement>(null)

  const onDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (over) {
      if (active.id !== over.id) {
        const newOrder = sortedItems.slice()
        const activeIndex = newOrder.findIndex((item) => item.id === active.id)
        const overIndex = newOrder.findIndex((item) => item.id === over.id)
        if (activeIndex === -1 || overIndex === -1) return
        const [activeItem] = newOrder.splice(activeIndex, 1)
        if (!activeItem) return
        newOrder.splice(overIndex, 0, activeItem)
        setSortedItems(newOrder)
        await setOverrideConfig({ items: newOrder })
      }
    }
  }

  useEffect(() => {
    pageRef.current?.addEventListener('dragover', (e) => {
      e.preventDefault()
      e.stopPropagation()
      setFileOver(true)
    })
    pageRef.current?.addEventListener('dragleave', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const rect = pageRef.current?.getBoundingClientRect()
      if (
        rect &&
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      )
        return
      setFileOver(false)
    })
    pageRef.current?.addEventListener('drop', async (event) => {
      event.preventDefault()
      event.stopPropagation()
      if (isProcessingDrop.current) return
      isProcessingDrop.current = true
      const dataTransfer = event.dataTransfer
      const file = dataTransfer?.files[0]
      if (file) {
        if (
          file.name.endsWith('.js') ||
          file.name.endsWith('.yml') ||
          file.name.endsWith('.yaml') ||
          file.name.endsWith('.json') ||
          file.name.endsWith('.jsonc') ||
          file.name.endsWith('.json5') ||
          file.name.endsWith('.txt')
        ) {
          try {
            const path = window.api.webUtils.getPathForFile(file)
            const content = await readTextFile(path)
            await addOverrideItem({
              name: file.name,
              type: 'local',
              file: content,
              ext: file.name.endsWith('.js') ? 'js' : 'yaml'
            })
          } catch (e) {
            notify('文件导入失败' + e, { variant: 'danger' })
          }
        } else {
          notify('不支持的文件类型', { variant: 'danger' })
        }
      } else {
        const droppedUrl =
          dataTransfer
            ?.getData('text/uri-list')
            .split(/\r?\n/)
            .find((value) => value && !value.startsWith('#')) ||
          dataTransfer?.getData('text/plain').trim()
        try {
          const urlObj = new URL(droppedUrl || '')
          if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') throw new Error()
          setEditingItem({
            id: '',
            name: '',
            type: 'remote',
            url: droppedUrl,
            ext: urlObj.pathname.endsWith('.js') ? 'js' : 'yaml',
            updated: Date.now()
          })
          setShowEditModal(true)
        } catch {
          notify('未检测到有效的覆写链接', { variant: 'danger' })
        }
      }
      isProcessingDrop.current = false
      setFileOver(false)
    })
    return (): void => {
      pageRef.current?.removeEventListener('dragover', () => {})
      pageRef.current?.removeEventListener('dragleave', () => {})
      pageRef.current?.removeEventListener('drop', () => {})
    }
  }, [])

  useEffect(() => {
    setSortedItems(itemsArray)
  }, [itemsArray])

  return (
    <BasePage
      ref={pageRef}
      title="覆写"
      contentClassName="no-scrollbar"
      header={
        <>
          <Button
            size="sm"
            isIconOnly
            onPress={() => {
              open('https://mihomo.party/docs/guide/override')
            }}
            variant="ghost"
            data-color="default"
            className="app-nodrag"
          >
            <HiOutlineDocumentText className="text-lg" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            onPress={() => {
              open('https://github.com/mihomo-party-org/override-hub')
            }}
            variant="ghost"
            data-color="default"
            className="app-nodrag"
          >
            <RiArchiveLine className="text-lg" />
          </Button>
        </>
      }
    >
      <div className="sticky top-0 z-40">
        <div className="flex p-2">
          <InputGroup fullWidth>
            <InputGroup.Input value={url} onChange={(event) => setUrl(event.target.value)} />
            <InputGroup.Suffix>
              {
                <Button
                  size="sm"
                  isIconOnly
                  onPress={() => {
                    navigator.clipboard.readText().then((text) => {
                      setUrl(text)
                    })
                  }}
                  variant="ghost"
                  data-color="default"
                >
                  <MdContentPaste className="text-lg" />
                </Button>
              }
            </InputGroup.Suffix>
          </InputGroup>
          <Button
            size="sm"
            onPress={handleImport}
            variant="primary"
            data-color="primary"
            className="ml-2"
            isPending={importing}
            isDisabled={url === '' || importing}
          >
            {importing ? <Spinner size="sm" color="current" /> : null}导入
          </Button>
          <Dropdown>
            <>
              <Button size="sm" isIconOnly variant="primary" data-color="primary" className="ml-2">
                <FaPlus />
              </Button>
            </>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={async (key) => {
                  if (key === 'open') {
                    try {
                      const files = await getFilePath(['js', 'yaml'])
                      if (files?.length) {
                        const content = await readTextFile(files[0])
                        const fileName = files[0].split('/').pop()?.split('\\').pop()
                        await addOverrideItem({
                          name: fileName,
                          type: 'local',
                          file: content,
                          ext: fileName?.endsWith('.js') ? 'js' : 'yaml'
                        })
                      }
                    } catch (e) {
                      notify(e, { variant: 'danger' })
                    }
                  } else if (key === 'new-yaml') {
                    await addOverrideItem({
                      name: '\u65B0\u5EFA YAML',
                      type: 'local',
                      file: '# https://mihomo.party/docs/guide/override/yaml',
                      ext: 'yaml'
                    })
                  } else if (key === 'new-js') {
                    await addOverrideItem({
                      name: '\u65B0\u5EFA JS',
                      type: 'local',
                      file: '// https://mihomo.party/docs/guide/override/javascript\nfunction main(config) {\n  return config\n}',
                      ext: 'js'
                    })
                  } else if (key === 'import') {
                    const newRemoteOverride: OverrideItem = {
                      id: '',
                      name: '',
                      type: 'remote',
                      url: '',
                      ext: 'yaml',
                      updated: Date.now()
                    }
                    setEditingItem(newRemoteOverride)
                    setShowEditModal(true)
                  }
                }}
              >
                <Dropdown.Item
                  key="open"
                  id="open"
                  className="app-dropdown-item"
                  textValue="打开本地覆写"
                >
                  <Label>打开本地覆写</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  key="import"
                  id="import"
                  className="app-dropdown-item"
                  textValue="导入远程覆写"
                >
                  <Label>导入远程覆写</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  key="new-yaml"
                  id="new-yaml"
                  className="app-dropdown-item"
                  textValue="新建 YAML"
                >
                  <Label>新建 YAML</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  key="new-js"
                  id="new-js"
                  className="app-dropdown-item"
                  textValue="新建 JavaScript"
                >
                  <Label>新建 JavaScript</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
        <Separator />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <div
          className={`${fileOver ? 'blur-sm' : ''} grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 m-2`}
        >
          <SortableContext
            items={sortedItems.map((item) => {
              return item.id
            })}
          >
            {sortedItems.map((item) => (
              <OverrideItem
                key={item.id}
                addOverrideItem={addOverrideItem}
                removeOverrideItem={removeOverrideItem}
                mutateOverrideConfig={mutateOverrideConfig}
                updateOverrideItem={updateOverrideItem}
                info={item}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
      {showEditModal && editingItem && (
        <EditInfoModal
          item={editingItem}
          updateOverrideItem={async (item: OverrideItem) => {
            await addOverrideItem(item)
            setShowEditModal(false)
            setEditingItem(null)
          }}
          onClose={() => {
            setShowEditModal(false)
            setEditingItem(null)
          }}
        />
      )}
    </BasePage>
  )
}

export default Override
