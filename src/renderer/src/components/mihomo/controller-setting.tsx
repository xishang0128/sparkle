import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input, Select, SelectItem, Switch } from '@heroui/react'
import { mihomoUpgradeUI, restartCore } from '@renderer/utils/ipc'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import EditableList from '../base/base-list-editor'
import { IoMdCloudDownload, IoMdRefresh } from 'react-icons/io'
import { HiExternalLink } from 'react-icons/hi'
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai'
import { isValidListenAddress } from '@renderer/utils/validate'

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
  const [externalControllerError, setExternalControllerError] = useState(
    !isValidListenAddress(externalController)
  )

  const upgradeUI = async (): Promise<void> => {
    try {
      setUpgrading(true)
      await mihomoUpgradeUI()
      new Notification('面板更新成功')
    } catch (e) {
      alert(e)
    } finally {
      setUpgrading(false)
    }
  }
  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
    setTimeout(async () => {
      await upgradeUI()
    }, 1000)
  }
  const generateRandomString = (length: number): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  return (
    <SettingCard title="外部控制器">
      <SettingItem title="监听地址" divider={externalController !== ''}>
        <div className="flex">
          {externalControllerInput != externalController && (
            <Button
              size="sm"
              color="primary"
              className="mr-2"
              isDisabled={externalControllerError}
              onPress={() => {
                onChangeNeedRestart({
                  'external-controller': externalControllerInput
                })
              }}
            >
              确认
            </Button>
          )}
          <Input
            size="sm"
            className={`w-[200px] ${externalControllerError ? 'border-red-500 ring-1 ring-red-500 rounded-lg' : ''}`}
            value={externalControllerInput}
            onValueChange={(v) => {
              setExternalControllerInput(v)
              setExternalControllerError(!isValidListenAddress(v))
            }}
          />
        </div>
      </SettingItem>
      {externalController && externalController !== '' && (
        <>
          <SettingItem
            title="访问密钥"
            actions={
              <Button
                size="sm"
                isIconOnly
                title="生成密钥"
                variant="light"
                onPress={() => setSecretInput(generateRandomString(32))}
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
                  color="primary"
                  className="mr-2"
                  onPress={() => {
                    onChangeNeedRestart({ secret: secretInput })
                  }}
                >
                  确认
                </Button>
              )}
              <Input
                size="sm"
                type={showPassword ? 'text' : 'password'}
                className="w-[200px]"
                value={secretInput}
                onValueChange={setSecretInput}
                startContent={
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
              />
            </div>
          </SettingItem>
          <SettingItem title="启用控制器面板" divider>
            <Switch
              size="sm"
              isSelected={enableExternalUi}
              onValueChange={(v) => {
                setEnableExternalUi(v)
                onChangeNeedRestart({
                  'external-ui': v ? 'ui' : undefined
                })
              }}
            />
          </SettingItem>
          {enableExternalUi && (
            <SettingItem
              title="控制器面板"
              actions={
                <>
                  <Button
                    size="sm"
                    isIconOnly
                    title="更新面板"
                    variant="light"
                    isLoading={upgrading}
                    onPress={upgradeUI}
                  >
                    <IoMdCloudDownload className="text-lg" />
                  </Button>
                  <Button
                    title="在浏览器中打开"
                    isIconOnly
                    size="sm"
                    className="app-nodrag"
                    variant="light"
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
                    color="primary"
                    className="mr-2"
                    onPress={() => {
                      onChangeNeedRestart({
                        'external-ui-url': externalUiUrlInput
                      })
                    }}
                  >
                    确认
                  </Button>
                )}
                <Select
                  classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
                  className="w-[150px]"
                  size="sm"
                  selectedKeys={new Set([externalUiUrlInput])}
                  disallowEmptySelection={true}
                  onSelectionChange={(v) => {
                    setExternalUiUrlInput(v.currentKey as string)
                  }}
                >
                  <SelectItem key="https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip">
                    zashboard
                  </SelectItem>
                  <SelectItem key="https://github.com/MetaCubeX/metacubexd/archive/refs/heads/gh-pages.zip">
                    metacubexd
                  </SelectItem>
                  <SelectItem key="https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip">
                    yacd-meta
                  </SelectItem>
                  <SelectItem key="https://github.com/haishanh/yacd/archive/refs/heads/gh-pages.zip">
                    yacd
                  </SelectItem>
                  <SelectItem key="https://github.com/MetaCubeX/Razord-meta/archive/refs/heads/gh-pages.zip">
                    razord-meta
                  </SelectItem>
                </Select>
              </div>
            </SettingItem>
          )}
          <SettingItem title="CORS 配置"></SettingItem>
          <div className="flex flex-col space-y-2 mt-2"></div>
          <SettingItem title="允许私有网络访问">
            <Switch
              size="sm"
              isSelected={allowPrivateNetwork}
              onValueChange={(v) => {
                onChangeNeedRestart({
                  'external-controller-cors': {
                    ...externalControllerCors,
                    'allow-private-network': v
                  }
                })
              }}
            />
          </SettingItem>
          <div className="mt-1"></div>
          <SettingItem title="允许的来源">
            {allowOriginsInput.join(',') != initialAllowOrigins.join(',') && (
              <Button
                size="sm"
                color="primary"
                onPress={() => {
                  const finalOrigins = allowOriginsInput.length == 0 ? ['*'] : allowOriginsInput
                  onChangeNeedRestart({
                    'external-controller-cors': {
                      ...externalControllerCors,
                      'allow-origins': finalOrigins
                    }
                  })
                }}
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
