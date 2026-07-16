import { Button, Drawer, Input, InputGroup, Switch, Tooltip } from '@heroui-v3/react'
import React, { useState, useEffect, useRef } from 'react'
import SettingItem from '../base/base-setting-item'
import { SettingTabs, settingItemProps } from '../base/base-controls'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  ageIdentityToRecipient,
  generateAgeKeyPair,
  getGistUrl,
  getUserAgent
} from '@renderer/utils/ipc'
import debounce from '@renderer/utils/debounce'
import { IoIosHelpCircle } from 'react-icons/io'
import { BiCopy, BiHide, BiShow } from 'react-icons/bi'
import { LuArrowRight, LuRefreshCw } from 'react-icons/lu'
import { notify } from '@renderer/utils/notification'

interface Props {
  onClose: () => void
  reopenSignal?: number
}

const DRAWER_CLOSE_ANIMATION_MS = 700

const ProfileSettingDrawer: React.FC<Props> = (props) => {
  const { onClose, reopenSignal } = props
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    profileDisplayDate = 'update',
    userAgent,
    diffWorkDir = false,
    githubToken = '',
    gistSyncEnabled = githubToken !== '',
    gistEncrypted = false,
    gistAgeRecipient = '',
    gistAgeIdentity = ''
  } = appConfig || {}

  const [ua, setUa] = useState(userAgent ?? '')
  const [tokenVisible, setTokenVisible] = useState(false)
  const [gistAgeIdentityVisible, setGistAgeIdentityVisible] = useState(false)
  const [defaultUserAgent, setDefaultUserAgent] = useState<string>('')
  const userAgentFetched = useRef(false)
  const [isOpen, setIsOpen] = useState(true)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setUaDebounce = useRef(
    debounce((v: string) => {
      patchAppConfig({ userAgent: v })
    }, 500)
  ).current

  useEffect(() => {
    if (!userAgentFetched.current) {
      userAgentFetched.current = true
      getUserAgent().then((ua) => {
        setDefaultUserAgent(ua)
      })
    }
  }, [])

  useEffect(() => {
    setUa(userAgent ?? '')
  }, [userAgent])

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
    setIsOpen(true)
  }, [reopenSignal])

  const copyValue = async (value: string | undefined, title: string): Promise<void> => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    notify(title, { variant: 'success' })
  }

  const handleGenerateGistAgeKeyPair = async (): Promise<void> => {
    try {
      const keyPair = await generateAgeKeyPair()
      await patchAppConfig({
        gistAgeIdentity: keyPair.identity,
        gistAgeRecipient: keyPair.recipient
      })
      notify('已生成 age 密钥', { variant: 'success' })
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  const handleDeriveGistAgeRecipient = async (): Promise<void> => {
    try {
      const recipient = await ageIdentityToRecipient(gistAgeIdentity)
      await patchAppConfig({ gistAgeRecipient: recipient })
      notify('已生成 age 公钥', { variant: 'success' })
    } catch (e) {
      notify(e, { variant: 'danger' })
    }
  }

  const closeWithAnimation = (): void => {
    if (closeTimer.current) return

    setIsOpen(false)
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      onClose()
    }, DRAWER_CLOSE_ANIMATION_MS)
  }

  return (
    <Drawer.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) closeWithAnimation()
      }}
      variant="blur"
      className="top-12 h-[calc(100%-48px)]"
    >
      <Drawer.Content placement="right" className="top-12 h-[calc(100%-48px)] p-3 pl-0">
        <Drawer.Dialog className="flex h-full w-[min(460px,calc(100vw-32px))] max-w-none flex-col overflow-hidden rounded-2xl! border border-separator/70 bg-overlay p-0 shadow-overlay flag-emoji">
          <Drawer.Header className="border-b border-separator/70 px-5 py-4">
            <Drawer.Heading className="text-base font-semibold">订阅设置</Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body className="no-scrollbar flex-1 overflow-y-auto px-5 py-3">
            <div className="flex flex-col gap-1">
              <SettingItem title="显示日期" {...settingItemProps} divider>
                <SettingTabs
                  ariaLabel="显示日期"
                  selectedKey={profileDisplayDate}
                  options={[
                    { id: 'update', label: '更新时间' },
                    { id: 'expire', label: '到期时间' }
                  ]}
                  onChange={async (v) => {
                    await patchAppConfig({
                      profileDisplayDate: v as 'expire' | 'update'
                    })
                  }}
                />
              </SettingItem>
              <SettingItem
                title="为不同订阅分别指定工作目录"
                actions={
                  <Tooltip>
                    <Button aria-label="说明" isIconOnly size="sm" variant="ghost">
                      <IoIosHelpCircle className="text-lg" />
                    </Button>
                    <Tooltip.Content>
                      开启后可以避免不同订阅中存在相同代理组名时无法分别保存选择的节点
                    </Tooltip.Content>
                  </Tooltip>
                }
                {...settingItemProps}
                divider
              >
                <Switch
                  aria-label="为不同订阅分别指定工作目录"
                  isSelected={diffWorkDir}
                  onChange={(v) => {
                    patchAppConfig({ diffWorkDir: v })
                  }}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </SettingItem>
              <SettingItem title="订阅拉取 UA" {...settingItemProps} divider>
                <Input
                  aria-label="订阅拉取 UA"
                  data-setting-input="wide"
                  value={ua}
                  placeholder={`默认 ${defaultUserAgent}`}
                  variant="secondary"
                  onChange={(event) => {
                    const v = event.target.value
                    setUa(v)
                    setUaDebounce(v)
                  }}
                />
              </SettingItem>
              <SettingItem
                title="同步运行时配置到 Gist"
                actions={
                  gistSyncEnabled && (
                    <Button
                      aria-label="复制 Gist URL"
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={async () => {
                        try {
                          const url = await getGistUrl()
                          if (url !== '') {
                            const fileName = gistEncrypted ? 'sparkle.yaml.age' : 'sparkle.yaml'
                            await navigator.clipboard.writeText(`${url}/raw/${fileName}`)
                            notify('已复制 Gist URL', { variant: 'success' })
                          }
                        } catch (e) {
                          notify(e, { variant: 'danger' })
                        }
                      }}
                    >
                      <BiCopy className="text-lg" />
                    </Button>
                  )
                }
                {...settingItemProps}
              >
                <Switch
                  aria-label="同步运行时配置到 Gist"
                  isSelected={gistSyncEnabled}
                  onChange={(v) => {
                    patchAppConfig({ gistSyncEnabled: v })
                  }}
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                  </Switch.Content>
                </Switch>
              </SettingItem>
              {gistSyncEnabled && (
                <SettingItem title={null} {...settingItemProps} divider>
                  <InputGroup data-setting-input="full" variant="secondary">
                    <InputGroup.Input
                      aria-label="GitHub Token"
                      type={tokenVisible ? 'text' : 'password'}
                      value={githubToken}
                      placeholder="GitHub Token"
                      onChange={(event) => {
                        patchAppConfig({ githubToken: event.target.value })
                      }}
                    />
                    <InputGroup.Suffix>
                      <Button
                        aria-label={tokenVisible ? '隐藏 GitHub Token' : '显示 GitHub Token'}
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => setTokenVisible((visible) => !visible)}
                      >
                        {tokenVisible ? (
                          <BiHide className="text-lg" />
                        ) : (
                          <BiShow className="text-lg" />
                        )}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                </SettingItem>
              )}
              {gistSyncEnabled && (
                <SettingItem title="加密 Gist 配置" {...settingItemProps} divider>
                  <Switch
                    aria-label="加密 Gist 配置"
                    isSelected={gistEncrypted}
                    onChange={(v) => {
                      patchAppConfig({ gistEncrypted: v })
                    }}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                    </Switch.Content>
                  </Switch>
                </SettingItem>
              )}
              {gistSyncEnabled && gistEncrypted && (
                <SettingItem title="Gist age 公钥" {...settingItemProps} divider>
                  <InputGroup data-setting-input="full" variant="secondary">
                    <InputGroup.Input
                      aria-label="Gist age 公钥"
                      value={gistAgeRecipient}
                      placeholder="age1..."
                      onChange={(event) => {
                        patchAppConfig({
                          gistAgeRecipient: event.target.value.trim() || undefined
                        })
                      }}
                    />
                    <InputGroup.Suffix>
                      <Tooltip>
                        <Button
                          aria-label="从 Gist age 私钥生成公钥"
                          isIconOnly
                          size="sm"
                          variant="ghost"
                          onPress={handleDeriveGistAgeRecipient}
                        >
                          <LuArrowRight className="text-lg" />
                        </Button>
                        <Tooltip.Content>从私钥生成公钥</Tooltip.Content>
                      </Tooltip>
                      <Button
                        aria-label="复制 Gist age 公钥"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => copyValue(gistAgeRecipient, '已复制 age 公钥')}
                      >
                        <BiCopy className="text-lg" />
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                </SettingItem>
              )}
              {gistSyncEnabled && gistEncrypted && (
                <SettingItem title="Gist age 私钥" {...settingItemProps}>
                  <InputGroup data-setting-input="full" variant="secondary">
                    <InputGroup.Input
                      aria-label="Gist age 私钥"
                      type={gistAgeIdentityVisible ? 'text' : 'password'}
                      value={gistAgeIdentity}
                      placeholder="AGE-SECRET-KEY-1..."
                      onChange={(event) => {
                        patchAppConfig({
                          gistAgeIdentity: event.target.value.trim() || undefined
                        })
                      }}
                    />
                    <InputGroup.Suffix>
                      <Button
                        aria-label="生成 Gist age 私钥"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={handleGenerateGistAgeKeyPair}
                      >
                        <LuRefreshCw className="text-lg" />
                      </Button>
                      <Button
                        aria-label="复制 Gist age 私钥"
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => copyValue(gistAgeIdentity, '已复制 age 私钥')}
                      >
                        <BiCopy className="text-lg" />
                      </Button>
                      <Button
                        aria-label={
                          gistAgeIdentityVisible ? '隐藏 Gist age 私钥' : '显示 Gist age 私钥'
                        }
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        onPress={() => setGistAgeIdentityVisible((visible) => !visible)}
                      >
                        {gistAgeIdentityVisible ? (
                          <BiHide className="text-lg" />
                        ) : (
                          <BiShow className="text-lg" />
                        )}
                      </Button>
                    </InputGroup.Suffix>
                  </InputGroup>
                </SettingItem>
              )}
            </div>
          </Drawer.Body>
          <Drawer.CloseTrigger className="app-nodrag" />
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  )
}

export default ProfileSettingDrawer
