import { Button, Input, Switch } from '@heroui/react'

import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import EditableList from '../base/base-list-editor'

import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore, startSubStoreBackendServer, triggerSysProxy } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { FaNetworkWired } from 'react-icons/fa'
import InterfaceModal from '@renderer/components/mihomo/interface-modal'

const PortSetting: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { sysProxy, onlyActiveDevice = false } = appConfig || {}
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    authentication = [],
    'skip-auth-prefixes': skipAuthPrefixes = ['127.0.0.1/32'],
    'allow-lan': allowLan,
    'lan-allowed-ips': lanAllowedIps = [],
    'lan-disallowed-ips': lanDisallowedIps = [],
    'mixed-port': mixedPort = 7890,
    'socks-port': socksPort = 0,
    port: httpPort = 0,
    'redir-port': redirPort = 0,
    'tproxy-port': tproxyPort = 0
  } = controledMihomoConfig || {}

  const [mixedPortInput, setMixedPortInput] = useState(mixedPort)
  const [socksPortInput, setSocksPortInput] = useState(socksPort)
  const [httpPortInput, setHttpPortInput] = useState(httpPort)
  const [redirPortInput, setRedirPortInput] = useState(redirPort)
  const [tproxyPortInput, setTproxyPortInput] = useState(tproxyPort)
  const [lanAllowedIpsInput, setLanAllowedIpsInput] = useState(lanAllowedIps)
  const [lanDisallowedIpsInput, setLanDisallowedIpsInput] = useState(lanDisallowedIps)
  const [authenticationInput, setAuthenticationInput] = useState(authentication)
  const [skipAuthPrefixesInput, setSkipAuthPrefixesInput] = useState(skipAuthPrefixes)
  const [lanOpen, setLanOpen] = useState(false)
  const parseAuth = (
    item: string
  ): {
    part1: string
    part2: string
  } => {
    const [user = '', pass = ''] = item.split(':')
    return { part1: user, part2: pass }
  }
  const formatAuth = (user: string, pass?: string): string => `${user}:${pass || ''}`
  const hasPortConflict = (): boolean => {
    const ports = [
      mixedPortInput,
      socksPortInput,
      httpPortInput,
      redirPortInput,
      tproxyPortInput
    ].filter((p) => p !== 0)
    return new Set(ports).size !== ports.length
  }

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <>
      {lanOpen && <InterfaceModal onClose={() => setLanOpen(false)} />}
      <SettingCard header="端口设置">
        <SettingItem compatKey="legacy" title="混合端口" divider>
          <div className="flex">
            {mixedPortInput !== mixedPort && (
              <Button
                size="sm"
                onPress={async () => {
                  await onChangeNeedRestart({ 'mixed-port': mixedPortInput })
                  await startSubStoreBackendServer()
                  if (sysProxy?.enable) {
                    triggerSysProxy(true, onlyActiveDevice)
                  }
                }}
                variant="primary"
                data-color="primary"
                className="mr-2"
                isDisabled={hasPortConflict()}
              >
                确认
              </Button>
            )}
            <Input
              type="number"
              value={mixedPortInput.toString()}
              max={65535}
              min={0}
              onChange={(event) => {
                const v = event.target.value
                setMixedPortInput(parseInt(v) || 0)
              }}
              className="w-25"
              fullWidth
            />
          </div>
        </SettingItem>
        <SettingItem compatKey="legacy" title="Socks 端口" divider>
          <div className="flex">
            {socksPortInput !== socksPort && (
              <Button
                size="sm"
                onPress={() => {
                  onChangeNeedRestart({ 'socks-port': socksPortInput })
                }}
                variant="primary"
                data-color="primary"
                className="mr-2"
                isDisabled={hasPortConflict()}
              >
                确认
              </Button>
            )}
            <Input
              type="number"
              value={socksPortInput.toString()}
              max={65535}
              min={0}
              onChange={(event) => {
                const v = event.target.value
                setSocksPortInput(parseInt(v) || 0)
              }}
              className="w-25"
              fullWidth
            />
          </div>
        </SettingItem>
        <SettingItem compatKey="legacy" title="Http 端口" divider>
          <div className="flex">
            {httpPortInput !== httpPort && (
              <Button
                size="sm"
                onPress={() => {
                  onChangeNeedRestart({ port: httpPortInput })
                }}
                variant="primary"
                data-color="primary"
                className="mr-2"
                isDisabled={hasPortConflict()}
              >
                确认
              </Button>
            )}
            <Input
              type="number"
              value={httpPortInput.toString()}
              max={65535}
              min={0}
              onChange={(event) => {
                const v = event.target.value
                setHttpPortInput(parseInt(v) || 0)
              }}
              className="w-25"
              fullWidth
            />
          </div>
        </SettingItem>
        {platform !== 'win32' && (
          <SettingItem compatKey="legacy" title="Redir 端口" divider>
            <div className="flex">
              {redirPortInput !== redirPort && (
                <Button
                  size="sm"
                  onPress={() => {
                    onChangeNeedRestart({ 'redir-port': redirPortInput })
                  }}
                  variant="primary"
                  data-color="primary"
                  className="mr-2"
                  isDisabled={hasPortConflict()}
                >
                  确认
                </Button>
              )}
              <Input
                type="number"
                value={redirPortInput.toString()}
                max={65535}
                min={0}
                onChange={(event) => {
                  const v = event.target.value
                  setRedirPortInput(parseInt(v) || 0)
                }}
                className="w-25"
                fullWidth
              />
            </div>
          </SettingItem>
        )}
        {platform === 'linux' && (
          <SettingItem compatKey="legacy" title="TProxy 端口" divider>
            <div className="flex">
              {tproxyPortInput !== tproxyPort && (
                <Button
                  size="sm"
                  onPress={() => {
                    onChangeNeedRestart({ 'tproxy-port': tproxyPortInput })
                  }}
                  variant="primary"
                  data-color="primary"
                  className="mr-2"
                  isDisabled={hasPortConflict()}
                >
                  确认
                </Button>
              )}
              <Input
                type="number"
                value={tproxyPortInput.toString()}
                max={65535}
                min={0}
                onChange={(event) => {
                  const v = event.target.value
                  setTproxyPortInput(parseInt(v) || 0)
                }}
                className="w-25"
                fullWidth
              />
            </div>
          </SettingItem>
        )}
        <SettingItem
          compatKey="legacy"
          title="允许局域网连接"
          actions={
            <Button
              size="sm"
              isIconOnly
              onPress={() => {
                setLanOpen(true)
              }}
              variant="ghost"
              data-color="default"
            >
              <FaNetworkWired className="text-lg" />
            </Button>
          }
          divider
        >
          <Switch
            size="sm"
            isSelected={allowLan}
            onChange={(v) => {
              onChangeNeedRestart({ 'allow-lan': v })
            }}
            aria-label="允许局域网连接"
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch.Content>
          </Switch>
        </SettingItem>
        {allowLan && (
          <>
            <SettingItem compatKey="legacy" title="允许连接的 IP 段">
              {lanAllowedIpsInput.join('') !== lanAllowedIps.join('') && (
                <Button
                  size="sm"
                  onPress={() => {
                    onChangeNeedRestart({ 'lan-allowed-ips': lanAllowedIpsInput })
                  }}
                  variant="primary"
                  data-color="primary"
                >
                  确认
                </Button>
              )}
            </SettingItem>
            <EditableList
              items={lanAllowedIpsInput}
              onChange={(items) => setLanAllowedIpsInput(items as string[])}
              placeholder="IP 段"
            />
            <SettingItem compatKey="legacy" title="禁止连接的 IP 段">
              {lanDisallowedIpsInput.join('') !== lanDisallowedIps.join('') && (
                <Button
                  size="sm"
                  onPress={() => {
                    onChangeNeedRestart({ 'lan-disallowed-ips': lanDisallowedIpsInput })
                  }}
                  variant="primary"
                  data-color="primary"
                >
                  确认
                </Button>
              )}
            </SettingItem>
            <EditableList
              items={lanDisallowedIpsInput}
              onChange={(items) => setLanDisallowedIpsInput(items as string[])}
              placeholder="IP 段"
            />
          </>
        )}
        <SettingItem compatKey="legacy" title="用户验证">
          {authenticationInput.join() !== authentication.join() && (
            <Button
              size="sm"
              onPress={() => onChangeNeedRestart({ authentication: authenticationInput })}
              variant="primary"
              data-color="primary"
            >
              确认
            </Button>
          )}
        </SettingItem>
        <EditableList
          items={authenticationInput}
          onChange={(items) => setAuthenticationInput(items as string[])}
          placeholder="用户名"
          part2Placeholder="密码"
          parse={parseAuth}
          format={formatAuth}
        />
        <SettingItem compatKey="legacy" title="允许跳过验证的 IP 段">
          {skipAuthPrefixesInput.join('') !== skipAuthPrefixes.join('') && (
            <Button
              size="sm"
              onPress={() => {
                onChangeNeedRestart({ 'skip-auth-prefixes': skipAuthPrefixesInput })
              }}
              variant="primary"
              data-color="primary"
            >
              确认
            </Button>
          )}
        </SettingItem>
        <EditableList
          items={skipAuthPrefixesInput}
          onChange={(items) => setSkipAuthPrefixesInput(items as string[])}
          placeholder="IP 段"
          disableFirst
          divider={false}
        />
      </SettingCard>
    </>
  )
}

export default PortSetting
