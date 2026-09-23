import {
  Chip,
  Button,
  InputGroup,
  Spinner,
  Separator,
  Checkbox,
  Dropdown,
  Label
} from '@heroui/react'

import BasePage from '@renderer/components/base/base-page'
import ProfileItem from '@renderer/components/profiles/profile-item'
import EditInfoModal from '@renderer/components/profiles/edit-info-modal'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getFilePath, readTextFile, subStoreCollections, subStoreSubs } from '@renderer/utils/ipc'
import type { KeyboardEvent } from 'react'
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { MdContentPaste } from 'react-icons/md'
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { FaPlus } from 'react-icons/fa6'
import { IoMdRefresh } from 'react-icons/io'
import { MdTune } from 'react-icons/md'
import SubStoreIcon from '@renderer/components/base/substore-icon'
import ProfileSettingDrawer from '@renderer/components/profiles/profile-setting-drawer'
import useSWR from 'swr'
import { useNavigate } from 'react-router-dom'
import { useCardDndSensors } from '@renderer/hooks/use-card-dnd-sensors'
import { notify } from '@renderer/utils/notification'

const emptyItems: ProfileItem[] = []

const Profiles: React.FC = () => {
  const {
    profileConfig,
    setProfileConfig,
    addProfileItem,
    updateProfileItem,
    removeProfileItem,
    changeCurrentProfile,
    mutateProfileConfig
  } = useProfileConfig()
  const { appConfig } = useAppConfig()
  const { useSubStore = true, useCustomSubStore = false, customSubStoreUrl = '' } = appConfig || {}
  const { current, items } = profileConfig || {}
  const itemsArray = items ?? emptyItems
  const navigate = useNavigate()
  const [sortedItems, setSortedItems] = useState(itemsArray)
  const [useProxy, setUseProxy] = useState(false)
  const [subStoreImporting, setSubStoreImporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [fileOver, setFileOver] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isSettingDrawerOpen, setIsSettingDrawerOpen] = useState(false)
  const [settingDrawerReopenSignal, setSettingDrawerReopenSignal] = useState(0)
  const [editingItem, setEditingItem] = useState<ProfileItem | null>(null)
  const [url, setUrl] = useState('')
  const isUrlEmpty = url.trim() === ''
  const sensors = useCardDndSensors()
  const { data: subs = [], mutate: mutateSubs } = useSWR(
    useSubStore ? 'subStoreSubs' : undefined,
    useSubStore ? subStoreSubs : (): undefined => {}
  )
  const { data: collections = [], mutate: mutateCollections } = useSWR(
    useSubStore ? 'subStoreCollections' : undefined,
    useSubStore ? subStoreCollections : (): undefined => {}
  )
  const subStoreMenuItems = useMemo(() => {
    const items: {
      icon?: ReactNode
      key: string
      children: ReactNode
      textValue: string
      divider: boolean
    }[] = [
      {
        key: 'open-substore',
        children: '访问 Sub-Store',
        textValue: '访问 Sub-Store',
        icon: <SubStoreIcon className="text-lg" />,
        divider:
          (Boolean(subs) && subs.length > 0) || (Boolean(collections) && collections.length > 0)
      }
    ]
    if (subs) {
      subs.forEach((sub, index) => {
        items.push({
          key: `sub-${sub.name}`,
          textValue: sub.displayName || sub.name,
          children: (
            <div className="flex justify-between">
              <div>{sub.displayName || sub.name}</div>
              <div>
                {sub.tag?.map((tag) => {
                  return (
                    <Chip
                      key={tag}
                      size="sm"
                      data-color="default"
                      variant="primary"
                      data-radius="sm"
                      className={['ml-1'].filter(Boolean).join(' ')}
                    >
                      <Chip.Label>{tag}</Chip.Label>
                    </Chip>
                  )
                })}
              </div>
            </div>
          ),
          icon: sub.icon ? <img src={sub.icon} className="h-4.5 w-4.5" /> : null,
          divider: index === subs.length - 1 && Boolean(collections) && collections.length > 0
        })
      })
    }
    if (collections) {
      collections.forEach((sub) => {
        items.push({
          key: `collection-${sub.name}`,
          textValue: sub.displayName || sub.name,
          children: (
            <div className="flex justify-between">
              <div>{sub.displayName || sub.name}</div>
              <div>
                {sub.tag?.map((tag) => {
                  return (
                    <Chip
                      key={tag}
                      size="sm"
                      data-color="default"
                      variant="primary"
                      data-radius="sm"
                      className={['ml-1'].filter(Boolean).join(' ')}
                    >
                      <Chip.Label>{tag}</Chip.Label>
                    </Chip>
                  )
                })}
              </div>
            </div>
          ),
          icon: sub.icon ? <img src={sub.icon} className="h-4.5 w-4.5" /> : null,
          divider: false
        })
      })
    }
    return items
  }, [subs, collections])
  const handleImport = async (importUrl: string): Promise<void> => {
    if (importing) return
    setImporting(true)
    try {
      await addProfileItem({ name: '', type: 'remote', url: importUrl, useProxy, autoUpdate: true })
      setUrl('')
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
        await setProfileConfig({ current, items: newOrder })
      }
    }
  }

  const handleInputKeyUp = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key !== 'Enter' || isUrlEmpty || importing) return
    handleImport(e.currentTarget.value)
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
      const dataTransfer = event.dataTransfer
      const file = dataTransfer?.files[0]
      if (file) {
        if (
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
            await addProfileItem({ name: file.name, type: 'local', file: content })
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
            useProxy: false,
            autoUpdate: true
          })
          setShowEditModal(true)
        } catch {
          notify('未检测到有效的订阅链接', { variant: 'danger' })
        }
      }
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
      title="订阅管理"
      contentClassName="no-scrollbar"
      header={
        <>
          <Button
            size="sm"
            isIconOnly
            onPress={async () => {
              setUpdating(true)
              for (const item of itemsArray) {
                if (item.id === current) continue
                if (item.type !== 'remote') continue
                await addProfileItem(item)
              }
              const currentItem = itemsArray.find((item) => item.id === current)
              if (currentItem && currentItem.type === 'remote') {
                await addProfileItem(currentItem)
              }
              setUpdating(false)
            }}
            variant="ghost"
            data-color="default"
            className="app-nodrag"
          >
            <IoMdRefresh className={`text-lg ${updating ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            isIconOnly
            onPress={() => {
              setIsSettingDrawerOpen(true)
              setSettingDrawerReopenSignal((signal) => signal + 1)
            }}
            variant="ghost"
            data-color="default"
            className="app-nodrag"
          >
            <MdTune className="text-lg" />
          </Button>
        </>
      }
    >
      {isSettingDrawerOpen && (
        <ProfileSettingDrawer
          reopenSignal={settingDrawerReopenSignal}
          onClose={() => setIsSettingDrawerOpen(false)}
        />
      )}
      {showEditModal && editingItem && (
        <EditInfoModal
          item={editingItem}
          isCurrent={editingItem.id === current}
          updateProfileItem={async (item: ProfileItem) => {
            await addProfileItem(item)
            setShowEditModal(false)
            setEditingItem(null)
          }}
          onClose={() => {
            setShowEditModal(false)
            setEditingItem(null)
          }}
        />
      )}
      <div className="sticky profiles-sticky top-0 z-40">
        <div className="flex p-2">
          <InputGroup fullWidth>
            <InputGroup.Input
              value={url}
              onKeyUp={handleInputKeyUp}
              onChange={(event) => setUrl(event.target.value)}
            />
            <InputGroup.Suffix>
              {
                <>
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
                    className="z-10"
                  >
                    <MdContentPaste className="text-lg" />
                  </Button>
                  <Checkbox
                    className="whitespace-nowrap"
                    isSelected={useProxy}
                    onChange={setUseProxy}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      <Label>代理</Label>
                    </Checkbox.Content>
                  </Checkbox>
                </>
              }
            </InputGroup.Suffix>
          </InputGroup>

          <Button
            size="sm"
            onPress={() => handleImport(url)}
            variant="primary"
            data-color="primary"
            className="ml-2"
            isPending={importing}
            isDisabled={isUrlEmpty || importing}
          >
            {importing ? <Spinner size="sm" color="current" /> : null}导入
          </Button>
          {useSubStore && (
            <Dropdown
              onOpenChange={() => {
                mutateSubs()
                mutateCollections()
              }}
            >
              <>
                <Button
                  size="sm"
                  isIconOnly
                  variant="primary"
                  data-color="primary"
                  className="ml-2 substore-import"
                  isPending={subStoreImporting}
                  isDisabled={subStoreImporting}
                >
                  {subStoreImporting ? (
                    <Spinner size="sm" color="current" />
                  ) : (
                    <SubStoreIcon className="text-lg" />
                  )}
                </Button>
              </>
              <Dropdown.Popover>
                <Dropdown.Menu
                  className="max-h-[calc(100vh-200px)] overflow-y-auto"
                  onAction={async (key) => {
                    if (key === 'open-substore') {
                      navigate('/substore')
                    } else if (key.toString().startsWith('sub-')) {
                      setSubStoreImporting(true)
                      try {
                        const sub = subs.find(
                          (sub) => sub.name === key.toString().replace('sub-', '')
                        )
                        await addProfileItem({
                          name: sub?.displayName || sub?.name || '',
                          substore: !useCustomSubStore,
                          type: 'remote',
                          url: useCustomSubStore
                            ? `${customSubStoreUrl}/download/${key.toString().replace('sub-', '')}?target=ClashMeta`
                            : `/download/${key.toString().replace('sub-', '')}`,
                          useProxy
                        })
                      } catch (e) {
                        notify(e, { variant: 'danger' })
                      } finally {
                        setSubStoreImporting(false)
                      }
                    } else if (key.toString().startsWith('collection-')) {
                      setSubStoreImporting(true)
                      try {
                        const collection = collections.find(
                          (collection) =>
                            collection.name === key.toString().replace('collection-', '')
                        )
                        await addProfileItem({
                          name: collection?.displayName || collection?.name || '',
                          type: 'remote',
                          substore: !useCustomSubStore,
                          url: useCustomSubStore
                            ? `${customSubStoreUrl}/download/collection/${key.toString().replace('collection-', '')}?target=ClashMeta`
                            : `/download/collection/${key.toString().replace('collection-', '')}`,
                          useProxy
                        })
                      } catch (e) {
                        notify(e, { variant: 'danger' })
                      } finally {
                        setSubStoreImporting(false)
                      }
                    }
                  }}
                >
                  {subStoreMenuItems.map((item) => (
                    <Dropdown.Item
                      key={item.key}
                      id={item.key}
                      data-divider={item.divider}
                      className="app-dropdown-item"
                      textValue={item.textValue}
                    >
                      {item?.icon}
                      <Label>{item.children}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
          <Dropdown>
            <>
              <Button
                size="sm"
                isIconOnly
                variant="primary"
                data-color="primary"
                className="ml-2 new-profile"
              >
                <FaPlus />
              </Button>
            </>
            <Dropdown.Popover>
              <Dropdown.Menu
                onAction={async (key) => {
                  switch (key) {
                    case 'open': {
                      try {
                        const files = await getFilePath(['yml', 'yaml'])
                        if (files?.length) {
                          const content = await readTextFile(files[0])
                          const fileName = files[0].split('/').pop()?.split('\\').pop()
                          await addProfileItem({ name: fileName, type: 'local', file: content })
                        }
                      } catch (e) {
                        notify(e, { variant: 'danger' })
                      }
                      break
                    }
                    case 'new': {
                      {
                        await addProfileItem({
                          name: '\u65B0\u914D\u7F6E',
                          type: 'local',
                          file: 'proxies: []\nproxy-groups: []\nrules: []'
                        })
                      }
                      break
                    }
                    case 'import': {
                      const newRemoteProfile: ProfileItem = {
                        id: '',
                        name: '',
                        type: 'remote',
                        url: '',
                        useProxy: false,
                        autoUpdate: true
                      }
                      setEditingItem(newRemoteProfile)
                      setShowEditModal(true)
                      break
                    }
                  }
                }}
              >
                <Dropdown.Item
                  key="open"
                  id="open"
                  className="app-dropdown-item"
                  textValue="打开本地配置"
                >
                  <Label>打开本地配置</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  key="new"
                  id="new"
                  className="app-dropdown-item"
                  textValue="新建本地配置"
                >
                  <Label>新建本地配置</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  key="import"
                  id="import"
                  className="app-dropdown-item"
                  textValue="导入远程配置"
                >
                  <Label>导入远程配置</Label>
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
              <ProfileItem
                key={item.id}
                isCurrent={item.id === current}
                addProfileItem={addProfileItem}
                removeProfileItem={removeProfileItem}
                mutateProfileConfig={mutateProfileConfig}
                updateProfileItem={updateProfileItem}
                info={item}
                switching={switching}
                onClick={async () => {
                  setSwitching(true)
                  await changeCurrentProfile(item.id)
                  await new Promise((resolve) => {
                    setTimeout(resolve, 500)
                  })
                  setSwitching(false)
                }}
              />
            ))}
          </SortableContext>
        </div>
      </DndContext>
    </BasePage>
  )
}

export default Profiles
