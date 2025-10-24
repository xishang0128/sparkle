import { Button, Input, Switch, Tab, Tabs, Tooltip } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import SettingCard from '@renderer/components/base/base-setting-card'
import SettingItem from '@renderer/components/base/base-setting-item'
import EditableList from '@renderer/components/base/base-list-editor'
import PacEditorModal from '@renderer/components/sysproxy/pac-editor-modal'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import { openUWPTool, triggerSysProxy } from '@renderer/utils/ipc'
import React, { Key, useEffect, useState } from 'react'
import ByPassEditorModal from '@renderer/components/sysproxy/bypass-editor-modal'
import { IoIosHelpCircle } from 'react-icons/io'

const defaultPacScript = `
function FindProxyForURL(url, host) {
  return "PROXY 127.0.0.1:%mixed-port%; SOCKS5 127.0.0.1:%mixed-port%; DIRECT;";
}
`

const Sysproxy: React.FC = () => {
  const defaultBypass: string[] =
    platform === 'linux'
      ? [
          'localhost',
          '.local',
          '127.0.0.1/8',
          '192.168.0.0/16',
          '10.0.0.0/8',
          '172.16.0.0/12',
          '::1'
        ]
      : platform === 'darwin'
        ? [
            '127.0.0.1/8',
            '192.168.0.0/16',
            '10.0.0.0/8',
            '172.16.0.0/12',
            'localhost',
            '*.local',
            '*.crashlytics.com',
            '<local>'
          ]
        : [
            'localhost',
            '127.*',
            '192.168.*',
            '10.*',
            '172.16.*',
            '172.17.*',
            '172.18.*',
            '172.19.*',
            '172.20.*',
            '172.21.*',
            '172.22.*',
            '172.23.*',
            '172.24.*',
            '172.25.*',
            '172.26.*',
            '172.27.*',
            '172.28.*',
            '172.29.*',
            '172.30.*',
            '172.31.*',
            '<local>'
          ]

  const { appConfig, patchAppConfig } = useAppConfig()
  const { sysProxy, onlyActiveDevice = false } =
    appConfig || ({ sysProxy: { enable: false } } as AppConfig)
  const [changed, setChanged] = useState(false)
  const [values, originSetValues] = useState({
    enable: sysProxy.enable,
    host: sysProxy.host ?? '',
    bypass: sysProxy.bypass ?? defaultBypass,
    mode: sysProxy.mode ?? 'manual',
    pacScript: sysProxy.pacScript ?? defaultPacScript,
    useSysproxyHelper: sysProxy.useSysproxyHelper ?? false
  })
  useEffect(() => {
    originSetValues((prev) => ({
      ...prev,
      enable: sysProxy.enable
    }))
  }, [sysProxy.enable])
  const [openEditor, setOpenEditor] = useState(false)
  const [openPacEditor, setOpenPacEditor] = useState(false)

  const setValues = (v: typeof values): void => {
    originSetValues(v)
    setChanged(true)
  }
  const onSave = async (): Promise<void> => {
    // check valid TODO
    await patchAppConfig({ sysProxy: values })
    setChanged(false)
    if (values.enable) {
      try {
        await triggerSysProxy(values.enable, onlyActiveDevice)
      } catch (e) {
        alert(e)
        await patchAppConfig({ sysProxy: { enable: false } })
      }
    }
  }

  return (
    <BasePage
      title="系统代理设置"
      header={
        changed && (
          <Button color="primary" className="app-nodrag" size="sm" onPress={onSave}>
            保存
          </Button>
        )
      }
    >
      {openPacEditor && (
        <PacEditorModal
          script={values.pacScript || defaultPacScript}
          onCancel={() => setOpenPacEditor(false)}
          onConfirm={(script: string) => {
            setValues({ ...values, pacScript: script })
            setOpenPacEditor(false)
          }}
        />
      )}
      {openEditor && (
        <ByPassEditorModal
          bypass={values.bypass}
          onCancel={() => setOpenEditor(false)}
          onConfirm={async (list: string[]) => {
            setOpenEditor(false)
            setValues({
              ...values,
              bypass: list
            })
          }}
        />
      )}
      <SettingCard className="sysproxy-settings">
        <SettingItem title="代理主机" divider>
          <Input
            size="sm"
            className="w-[50%]"
            value={values.host}
            placeholder="默认 127.0.0.1 若无特殊需求请勿修改"
            onValueChange={(v) => {
              setValues({ ...values, host: v })
            }}
          />
        </SettingItem>
        <SettingItem title="代理模式" divider>
          <Tabs
            size="sm"
            color="primary"
            selectedKey={values.mode}
            onSelectionChange={(key: Key) => setValues({ ...values, mode: key as SysProxyMode })}
          >
            <Tab key="manual" title="手动" />
            <Tab key="auto" title="PAC" />
          </Tabs>
        </SettingItem>
        {platform === 'win32' && (
          <SettingItem title="UWP 工具" divider>
            <Button
              size="sm"
              onPress={async () => {
                await openUWPTool()
              }}
            >
              打开 UWP 工具
            </Button>
          </SettingItem>
        )}
        {platform == 'darwin' && (
          <>
            <SettingItem
              title="使用服务模式"
              actions={
                <Tooltip
                  content={
                    <>
                      <div>开启后，使用服务模式设置系统代理</div>
                      <div>
                        关闭后，使用 Exec 模式（需要关闭“访问系统范围的设置需要输入管理员密码”）
                      </div>
                    </>
                  }
                >
                  <Button isIconOnly size="sm" variant="light">
                    <IoIosHelpCircle className="text-lg" />
                  </Button>
                </Tooltip>
              }
              divider
            >
              <Switch
                size="sm"
                isSelected={values.useSysproxyHelper}
                onValueChange={(v) => {
                  setValues({ ...values, useSysproxyHelper: v })
                }}
              />
            </SettingItem>
            <SettingItem
              title="仅为活跃接口设置"
              actions={
                <Tooltip
                  content={
                    <>
                      <div>开启后，系统代理仅会为当前活跃的网络接口设置</div>
                      <div>其他接口将不会被设置代理（仅服务模式可用）</div>
                    </>
                  }
                >
                  <Button isIconOnly size="sm" variant="light">
                    <IoIosHelpCircle className="text-lg" />
                  </Button>
                </Tooltip>
              }
              divider
            >
              <Switch
                size="sm"
                isSelected={onlyActiveDevice}
                isDisabled={!values.useSysproxyHelper}
                onValueChange={(v) => {
                  patchAppConfig({ onlyActiveDevice: v })
                }}
              />
            </SettingItem>
          </>
        )}
        {values.mode === 'auto' && (
          <SettingItem title="代理模式">
            <Button size="sm" onPress={() => setOpenPacEditor(true)}>
              编辑 PAC 脚本
            </Button>
          </SettingItem>
        )}
        {values.mode === 'manual' && (
          <>
            <SettingItem title="添加默认代理绕过" divider>
              <Button
                size="sm"
                onPress={() => {
                  setValues({
                    ...values,
                    bypass: Array.from(new Set([...defaultBypass, ...values.bypass]))
                  })
                }}
              >
                添加默认代理绕过
              </Button>
            </SettingItem>
            <SettingItem title="代理绕过列表">
              <Button
                size="sm"
                onPress={async () => {
                  setOpenEditor(true)
                }}
              >
                编辑
              </Button>
            </SettingItem>
            <EditableList
              items={values.bypass}
              onChange={(list) => setValues({ ...values, bypass: list as string[] })}
              placeholder="例：*.baidu.com"
              divider={false}
            />
          </>
        )}
      </SettingCard>
    </BasePage>
  )
}

export default Sysproxy
