import { Button, Input, InputGroup, Modal, Switch, Tooltip } from '@heroui-v3/react'
import React, { useState, useEffect, useRef } from 'react'
import SettingItem from '../base/base-setting-item'
import { SettingTabs, settingItemProps } from '../base/base-controls'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getGistUrl, getUserAgent } from '@renderer/utils/ipc'
import debounce from '@renderer/utils/debounce'
import { IoIosHelpCircle } from 'react-icons/io'
import { BiCopy, BiHide, BiShow } from 'react-icons/bi'

interface Props {
  onClose: () => void
}

const ProfileSettingModal: React.FC<Props> = (props) => {
  const { onClose } = props
  const { appConfig, patchAppConfig } = useAppConfig()

  const {
    profileDisplayDate = 'update',
    userAgent,
    diffWorkDir = false,
    githubToken = '',
    gistSyncEnabled = githubToken !== ''
  } = appConfig || {}

  const [ua, setUa] = useState(userAgent ?? '')
  const [tokenVisible, setTokenVisible] = useState(false)
  const [defaultUserAgent, setDefaultUserAgent] = useState<string>('')
  const userAgentFetched = useRef(false)

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

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container>
          <Modal.Dialog className="max-w-md flag-emoji">
            <Modal.Header className="pb-0">
              <Modal.Heading>订阅设置</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="py-2 gap-1">
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
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
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
                            await navigator.clipboard.writeText(`${url}/raw/sparkle.yaml`)
                          }
                        } catch (e) {
                          alert(e)
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
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </SettingItem>
              {gistSyncEnabled && (
                <SettingItem title={null} {...settingItemProps}>
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
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ProfileSettingModal
