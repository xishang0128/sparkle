import {
  Button,
  Dropdown,
  Input,
  InputGroup,
  Label,
  Modal,
  Separator,
  Surface,
  Switch,
  Tooltip
} from '@heroui-v3/react'
import type { ReactNode } from 'react'
import React, { useState } from 'react'
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import { ageIdentityToRecipient, generateAgeKeyPair, restartCore } from '@renderer/utils/ipc'
import { MdDeleteForever } from 'react-icons/md'
import { FaPlus } from 'react-icons/fa6'
import { IoIosHelpCircle } from 'react-icons/io'
import { BiCopy, BiHide, BiShow } from 'react-icons/bi'
import { LuArrowRight, LuRefreshCw } from 'react-icons/lu'
import { notify } from '@renderer/utils/notification'

interface Props {
  item: ProfileItem
  isCurrent: boolean
  updateProfileItem: (item: ProfileItem) => Promise<void>
  onClose: () => void
}

const EditInfoModal: React.FC<Props> = (props) => {
  const { item, isCurrent, updateProfileItem, onClose } = props
  const { overrideConfig } = useOverrideConfig()
  const { items: overrideItems = [] } = overrideConfig || {}
  const [values, setValues] = useState({ ...item, autoUpdate: item.autoUpdate ?? true })
  const [ageIdentityVisible, setAgeIdentityVisible] = useState(false)

  const copyValue = async (value: string | undefined, title: string): Promise<void> => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    notify(title, { variant: 'success' })
  }

  const handleGenerateAgeKeyPair = async (): Promise<void> => {
    try {
      const keyPair = await generateAgeKeyPair()
      setValues((current) => ({
        ...current,
        ageIdentity: keyPair.identity,
        ageRecipient: keyPair.recipient
      }))
      notify('已生成 age 密钥', { variant: 'success' })
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  const handleDeriveAgeRecipient = async (): Promise<void> => {
    try {
      const recipient = await ageIdentityToRecipient(values.ageIdentity ?? '')
      setValues((current) => ({ ...current, ageRecipient: recipient }))
      notify('已生成 age 公钥', { variant: 'success' })
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  const onSave = async (): Promise<void> => {
    try {
      const itemToSave = {
        ...values,
        override: values.override?.filter(
          (i) =>
            overrideItems.find((t) => t.id === i) && !overrideItems.find((t) => t.id === i)?.global
        )
      }

      await updateProfileItem(itemToSave)
      if (item.id && isCurrent) {
        await restartCore()
      }
      onClose()
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  const renderField = (
    title: string,
    content: ReactNode,
    options?: {
      actions?: ReactNode
      align?: 'start' | 'center'
      divider?: boolean
      stacked?: boolean
    }
  ) => {
    const { actions, align = 'center', divider = true, stacked = false } = options || {}

    return (
      <Surface key={title} variant="transparent" className="flex flex-col">
        {stacked ? (
          <div className="flex flex-col gap-1.5 py-2">
            <div className="flex items-center gap-2">
              <Label className="setting-item__title">{title}</Label>
              {actions}
            </div>
            <div className="w-full min-w-0">{content}</div>
          </div>
        ) : (
          <div
            className={`setting-item px-0 setting-item--content-end ${
              align === 'start' ? 'setting-item--start' : 'setting-item--center'
            }`}
            style={{ gridTemplateColumns: '150px minmax(0, 1fr)' }}
          >
            <div className="setting-item__title-wrap">
              <Label className="setting-item__title">{title}</Label>
            </div>
            <div className="setting-item__content">
              <div className="flex w-full min-w-0 items-center justify-end gap-2">
                {actions}
                {content}
              </div>
            </div>
          </div>
        )}
        {divider ? <Separator variant="tertiary" className="bg-default-100/70" /> : null}
      </Surface>
    )
  }

  const globalOverrideRows = overrideItems
    .filter((i) => i.global)
    .map((i) => (
      <Surface
        key={i.id}
        variant="transparent"
        className="flex items-center gap-1.5 px-1.5 py-0.75"
      >
        <Button
          isDisabled
          fullWidth
          variant="secondary"
          size="sm"
          className="h-6.5 min-h-6.5 justify-start rounded-md px-2 text-[13px]"
        >
          {i.name} (全局)
        </Button>
      </Surface>
    ))

  const localOverrideRows = (values.override || []).flatMap((id) => {
    const overrideItem = overrideItems.find((item) => item.id === id)
    if (!overrideItem || overrideItem.global) return []

    return (
      <Surface key={id} variant="transparent" className="flex items-center gap-1.5 px-1.5 py-0.75">
        <Button
          isDisabled
          fullWidth
          variant="secondary"
          size="sm"
          className="h-6.5 min-h-6.5 justify-start rounded-md px-2 text-[13px]"
        >
          {overrideItem.name}
        </Button>
        <Button
          variant="danger-soft"
          size="sm"
          className="h-6.5 min-h-6.5 min-w-6.5 rounded-md px-1.5"
          onPress={() => {
            setValues({
              ...values,
              override: values.override?.filter((item) => item !== id)
            })
          }}
        >
          <MdDeleteForever className="text-lg" />
        </Button>
      </Surface>
    )
  })

  const overrideRows = [...globalOverrideRows, ...localOverrideRows]

  const overrideContent = (
    <Surface
      variant="secondary"
      className="w-40 max-w-full flex flex-col overflow-hidden rounded-lg"
    >
      {overrideRows}
      <Surface variant="transparent" className="px-1.5 py-0.75">
        <Dropdown>
          <Dropdown.Trigger className="block rounded-md">
            <Button fullWidth size="sm" variant="secondary" className="h-6.5 min-h-6.5 rounded-md">
              <FaPlus className="text-[13px]" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Popover placement="top" className="no-scrollbar overflow-y-auto rounded-lg">
            <Dropdown.Menu
              className="no-scrollbar p-1 text-sm"
              onAction={(key) => {
                setValues({
                  ...values,
                  override: Array.from(values.override || []).concat(key.toString())
                })
              }}
            >
              {overrideItems.filter((i) => !values.override?.includes(i.id) && !i.global).length >
              0 ? (
                overrideItems
                  .filter((i) => !values.override?.includes(i.id) && !i.global)
                  .map((i) => (
                    <Dropdown.Item
                      id={i.id}
                      key={i.id}
                      textValue={i.name}
                      className="min-h-8 rounded-md px-2.5 py-1.5"
                    >
                      <Label className="-translate-y-px text-sm leading-5">{i.name}</Label>
                    </Dropdown.Item>
                  ))
              ) : (
                <Dropdown.Item
                  id="empty"
                  key="empty"
                  textValue="没有可用的覆写"
                  isDisabled
                  className="min-h-8 rounded-md px-2.5 py-1.5"
                >
                  <Label className="-translate-y-px text-sm leading-5">没有可用的覆写</Label>
                </Dropdown.Item>
              )}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </Surface>
    </Surface>
  )

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[min(600px,calc(100%-24px))] max-w-none">
            <Modal.Header className="app-drag pb-1">
              <Modal.Heading>{item.id ? '编辑信息' : '导入远程配置'}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[70vh] overflow-y-auto pt-1 pb-2">
              <Surface variant="transparent" className="flex flex-col">
                {renderField(
                  '名称',
                  <Input
                    aria-label="名称"
                    data-setting-input="edit-modal-name"
                    value={values.name}
                    variant="secondary"
                    onChange={(event) => {
                      setValues({ ...values, name: event.target.value })
                    }}
                  />
                )}
                {values.type === 'remote' &&
                  renderField(
                    '订阅地址',
                    <Input
                      aria-label="订阅地址"
                      data-setting-input="edit-modal"
                      value={values.url}
                      variant="secondary"
                      onChange={(event) => {
                        setValues({ ...values, url: event.target.value })
                      }}
                    />,
                    { align: 'start' }
                  )}
                {values.type === 'remote' &&
                  renderField(
                    '证书指纹',
                    <Input
                      aria-label="证书指纹"
                      data-setting-input="edit-modal"
                      value={values.fingerprint ?? ''}
                      variant="secondary"
                      onChange={(event) => {
                        const v = event.target.value
                        setValues({ ...values, fingerprint: v.trim() || undefined })
                      }}
                    />
                  )}
                {values.type === 'remote' &&
                  renderField(
                    '指定 UA',
                    <Input
                      aria-label="指定 UA"
                      data-setting-input="edit-modal"
                      value={values.ua ?? ''}
                      variant="secondary"
                      onChange={(event) => {
                        const v = event.target.value
                        setValues({ ...values, ua: v.trim() || undefined })
                      }}
                    />
                  )}
                {values.type === 'remote' &&
                  renderField(
                    '验证订阅格式',
                    <Switch
                      aria-label="验证订阅格式"
                      size="sm"
                      isSelected={values.verify ?? false}
                      onChange={(v) => {
                        setValues({ ...values, verify: v })
                      }}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                  )}
                {values.type === 'remote' &&
                  renderField(
                    '使用代理更新',
                    <Switch
                      aria-label="使用代理更新"
                      size="sm"
                      isSelected={values.useProxy ?? false}
                      onChange={(v) => {
                        setValues({ ...values, useProxy: v })
                      }}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                  )}
                {values.type === 'remote' &&
                  renderField(
                    '自动更新',
                    <Switch
                      aria-label="自动更新"
                      size="sm"
                      isSelected={values.autoUpdate ?? false}
                      onChange={(v) => {
                        setValues({ ...values, autoUpdate: v })
                      }}
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                      </Switch.Content>
                    </Switch>
                  )}
                {renderField(
                  'age 公钥',
                  <InputGroup data-setting-input="edit-modal" variant="secondary">
                    <InputGroup.Input
                      aria-label="age 公钥"
                      value={values.ageRecipient ?? ''}
                      placeholder="age1..."
                      onChange={(event) => {
                        const v = event.target.value
                        setValues({ ...values, ageRecipient: v.trim() || undefined })
                      }}
                    />
                    <InputGroup.Suffix>
                      <Tooltip delay={0}>
                        <Tooltip.Trigger>
                          <Button
                            aria-label="从 age 私钥生成公钥"
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onPress={handleDeriveAgeRecipient}
                          >
                            <LuArrowRight className="text-lg" />
                          </Button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>从私钥生成公钥</Tooltip.Content>
                      </Tooltip>
                      <Button
                        aria-label="复制 age 公钥"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => copyValue(values.ageRecipient, '已复制 age 公钥')}
                      >
                        <BiCopy className="text-lg" />
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                )}
                {renderField(
                  'age 私钥',
                  <InputGroup data-setting-input="edit-modal" variant="secondary">
                    <InputGroup.Input
                      aria-label="age 私钥"
                      type={ageIdentityVisible ? 'text' : 'password'}
                      value={values.ageIdentity ?? ''}
                      placeholder="AGE-SECRET-KEY-1..."
                      onChange={(event) => {
                        const v = event.target.value
                        setValues({ ...values, ageIdentity: v.trim() || undefined })
                      }}
                    />
                    <InputGroup.Suffix>
                      <Button
                        aria-label="生成 age 私钥"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={handleGenerateAgeKeyPair}
                      >
                        <LuRefreshCw className="text-lg" />
                      </Button>
                      <Button
                        aria-label="复制 age 私钥"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => copyValue(values.ageIdentity, '已复制 age 私钥')}
                      >
                        <BiCopy className="text-lg" />
                      </Button>
                      <Button
                        aria-label={ageIdentityVisible ? '隐藏 age 私钥' : '显示 age 私钥'}
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => setAgeIdentityVisible((visible) => !visible)}
                      >
                        {ageIdentityVisible ? (
                          <BiHide className="text-lg" />
                        ) : (
                          <BiShow className="text-lg" />
                        )}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                )}
                {values.type === 'remote' &&
                  values.autoUpdate &&
                  renderField(
                    '更新间隔（分钟）',
                    <Input
                      aria-label="更新间隔（分钟）"
                      type="number"
                      data-setting-input="edit-modal-number"
                      value={values.interval?.toString() ?? ''}
                      variant="secondary"
                      onChange={(event) => {
                        setValues({ ...values, interval: parseInt(event.target.value) })
                      }}
                      disabled={values.locked}
                    />,
                    {
                      actions: values.locked ? (
                        <Tooltip delay={0}>
                          <Tooltip.Trigger>
                            <button
                              type="button"
                              aria-label="说明"
                              className="flex size-7 items-center justify-center rounded-full bg-transparent p-0 text-foreground outline-none ring-0 shadow-none hover:bg-transparent focus:bg-transparent focus:outline-none focus-visible:outline-none focus-visible:ring-0"
                            >
                              <IoIosHelpCircle className="text-lg" />
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Content>当前更新间隔由远程管理</Tooltip.Content>
                        </Tooltip>
                      ) : undefined
                    }
                  )}
                {renderField('覆写', overrideContent, { align: 'start', divider: false })}
              </Surface>
            </Modal.Body>
            <Modal.Footer className="justify-end pt-2">
              <Button size="sm" variant="secondary" onPress={onClose}>
                取消
              </Button>
              <Button size="sm" variant="primary" onPress={onSave}>
                {item.id ? '保存' : '导入'}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default EditInfoModal
