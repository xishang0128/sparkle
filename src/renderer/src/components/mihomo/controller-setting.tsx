import { Button, Input, Tooltip, InputGroup, Spinner, Select, Switch, ListBox } from '@heroui/react'

import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { mihomoUpgradeUI, restartCore } from '@renderer/utils/ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import EditableList from '../base/base-list-editor'
import { IoMdCloudDownload, IoMdRefresh } from 'react-icons/io'
import { HiExternalLink } from 'react-icons/hi'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai'
import { isValidListenAddress } from '@renderer/utils/validate'
import { notify } from '@renderer/utils/notification'

const ControllerSetting: React.FC = () => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    'external-controller': externalController = '',
    'external-ui': externalUi = '',
    'external-ui-url': externalUiUrl = '',
    'external-controller-cors': externalControllerCors,
    secret
  } = controledMihomoConfig || {}
  const {
    'allow-origins': allowOrigins = [],
    'allow-private-network': allowPrivateNetwork = true
  } = externalControllerCors || {}

  const initialAllowOrigins = allowOrigins.length == 1 && allowOrigins[0] == '*' ? [] : allowOrigins
  const [allowOriginsInput, setAllowOriginsInput] = useState(initialAllowOrigins)
  const [externalControllerInput, setExternalControllerInput] = useState(externalController)
  const [externalUiUrlInput, setExternalUiUrlInput] = useState(externalUiUrl)
  const [secretInput, setSecretInput] = useState(secret)
  const [enableExternalUi, setEnableExternalUi] = useState(externalUi == 'ui')
  const [upgrading, setUpgrading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [externalControllerError, setExternalControllerError] = useState<string | null>(() => {
    const r = isValidListenAddress(externalController)
    return r.ok ? null : (r.error ?? '格式错误')
  })

  const upgradeUI = async (): Promise<void> => {
    try {
      setUpgrading(true)
      await mihomoUpgradeUI()
      notify('面板更新成功', { variant: 'success' })
    } catch (e) {
      notify(e, { variant: 'danger' })
    } finally {
      setUpgrading(false)
    }
  }
  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
    if ('external-ui-url' in patch) {
      setTimeout(async () => {
        await upgradeUI()
      }, 1000)
    }
  }
  const generateRandomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  return (
    <SettingCard header="外部控制器">
      <SettingItem compatKey="legacy" title="监听地址" divider={externalController !== ''}>
        <div className="flex">
          {externalControllerInput != externalController && !externalControllerError && (
            <Button
              size="sm"
              onPress={() => {
                onChangeNeedRestart({
                  'external-controller': externalControllerInput
                })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
              isDisabled={!!externalControllerError}
            >
              确认
            </Button>
          )}
          <Tooltip isOpen={!!externalControllerError} delay={0}>
            <Tooltip.Trigger>
              <Input
                value={externalControllerInput}
                onChange={(event) => {
                  const v = event.target.value
                  setExternalControllerInput(v)
                  const r = isValidListenAddress(v)
                  setExternalControllerError(r.ok ? null : (r.error ?? '格式错误'))
                }}
                className={`w-50 ${externalControllerError ? 'border-red-500 ring-1 ring-red-500 rounded-lg' : ''}`}
                fullWidth
              />
            </Tooltip.Trigger>
            <Tooltip.Content placement="right" showArrow={true} offset={10} data-color="danger">
              <Tooltip.Arrow />
              {externalControllerError}
            </Tooltip.Content>
          </Tooltip>
        </div>
      </SettingItem>
      {externalController && externalController !== '' && (
        <>
          <SettingItem
            compatKey="legacy"
            title="访问密钥"
            actions={
              <Button
                size="sm"
                isIconOnly
                onPress={() => setSecretInput(generateRandomString(32))}
                variant="ghost"
                data-color="default"
              >
                <IoMdRefresh className="text-lg" />
              </Button>
            }
            divider
          >
            <div className="flex">
              {secretInput != secret && (
                <Button
                  size="sm"
                  onPress={() => {
                    onChangeNeedRestart({ secret: secretInput })
                  }}
                  variant="primary"
                  data-color="primary"
                  className="mr-2"
                >
                  确认
                </Button>
              )}
              <InputGroup className="w-50" fullWidth>
                <InputGroup.Prefix>
                  {
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <AiOutlineEyeInvisible className="w-4 h-4" />
                      ) : (
                        <AiOutlineEye className="w-4 h-4" />
                      )}
                    </button>
                  }
                </InputGroup.Prefix>
                <InputGroup.Input
                  type={showPassword ? 'text' : 'password'}
                  value={secretInput}
                  onChange={(event) => setSecretInput(event.target.value)}
                />
              </InputGroup>
            </div>
          </SettingItem>
          <SettingItem compatKey="legacy" title="启用控制器面板" divider>
            <Switch
              size="sm"
              isSelected={enableExternalUi}
              onChange={(v) => {
                setEnableExternalUi(v)
                onChangeNeedRestart({
                  'external-ui': v ? 'ui' : undefined
                })
              }}
              aria-label="启用控制器面板"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
          {enableExternalUi && (
            <SettingItem
              compatKey="legacy"
              title="控制器面板"
              actions={
                <>
                  <Button
                    size="sm"
                    isIconOnly
                    onPress={upgradeUI}
                    variant="ghost"
                    data-color="default"
                    isPending={upgrading}
                    isDisabled={upgrading}
                  >
                    {upgrading ? (
                      <Spinner size="sm" color="current" />
                    ) : (
                      <IoMdCloudDownload className="text-lg" />
                    )}
                  </Button>
                  <Button
                    isIconOnly
                    size="sm"
                    onPress={() => {
                      const controller = externalController.startsWith(':')
                        ? `127.0.0.1${externalController}`
                        : externalController
                      const host = controller.split(':')[0]
                      const port = controller.split(':')[1]
                      if (
                        ['zashboard', 'metacubexd'].find((keyword) =>
                          externalUiUrl.includes(keyword)
                        )
                      ) {
                        open(
                          `http://${controller}/ui/#/setup?hostname=${host}&port=${port}&secret=${secret}`
                        )
                      } else if (externalUiUrl.includes('Razord')) {
                        open(
                          `http://${controller}/ui/#/proxies?host=${host}&port=${port}&secret=${secret}`
                        )
                      } else {
                        if (secret && secret.length > 0) {
                          open(
                            `http://${controller}/ui/?hostname=${host}&port=${port}&secret=${secret}`
                          )
                        } else {
                          open(`http://${controller}/ui/?hostname=${host}&port=${port}`)
                        }
                      }
                    }}
                    variant="ghost"
                    data-color="default"
                    className="app-nodrag"
                  >
                    <HiExternalLink className="text-lg" />
                  </Button>
                </>
              }
              divider
            >
              <div className="flex">
                {externalUiUrlInput != externalUiUrl && (
                  <Button
                    size="sm"
                    onPress={() => {
                      onChangeNeedRestart({
                        'external-ui-url': externalUiUrlInput
                      })
                    }}
                    variant="primary"
                    data-color="primary"
                    className="mr-2"
                  >
                    确认
                  </Button>
                )}
                <Select
                  aria-label="外部 UI 来源"
                  className={['w-37.5'].filter(Boolean).join(' ')}
                  data-size="sm"
                  value={externalUiUrlInput ?? null}
                  onChange={(v) => {
                    setExternalUiUrlInput(v as string)
                  }}
                >
                  <Select.Trigger className="data-[hover=true]:bg-default-200">
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item
                        key="https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip"
                        id="https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip"
                        textValue="zashboard"
                      >
                        zashboard
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item
                        key="https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip"
                        id="https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip"
                        textValue="metacubexd"
                      >
                        metacubexd
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item
                        key="https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip"
                        id="https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip"
                        textValue="yacd-meta"
                      >
                        yacd-meta
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item
                        key="https://github.com/haishanh/yacd/archive/refs/heads/gh-pages.zip"
                        id="https://github.com/haishanh/yacd/archive/refs/heads/gh-pages.zip"
                        textValue="yacd"
                      >
                        yacd
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item
                        key="https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip"
                        id="https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip"
                        textValue="razord-meta"
                      >
                        razord-meta
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </SettingItem>
          )}
          <SettingItem compatKey="legacy" title="CORS 配置"></SettingItem>
          <div className="flex flex-col space-y-2 mt-2"></div>
          <SettingItem compatKey="legacy" title="允许私有网络访问">
            <Switch
              size="sm"
              isSelected={allowPrivateNetwork}
              onChange={(v) => {
                onChangeNeedRestart({
                  'external-controller-cors': {
                    ...externalControllerCors,
                    'allow-private-network': v
                  }
                })
              }}
              aria-label="允许私有网络访问"
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </SettingItem>
          <div className="mt-1"></div>
          <SettingItem compatKey="legacy" title="允许的来源">
            {allowOriginsInput.join(',') != initialAllowOrigins.join(',') && (
              <Button
                size="sm"
                onPress={() => {
                  const finalOrigins = allowOriginsInput.length == 0 ? ['*'] : allowOriginsInput
                  onChangeNeedRestart({
                    'external-controller-cors': {
                      ...externalControllerCors,
                      'allow-origins': finalOrigins
                    }
                  })
                }}
                variant="primary"
                data-color="primary"
              >
                确认
              </Button>
            )}
          </SettingItem>
          <EditableList
            items={allowOriginsInput}
            onChange={(items) => setAllowOriginsInput(items as string[])}
            divider={false}
          />
        </>
      )}
    </SettingCard>
  )
}

export default ControllerSetting
