import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Switch,
  Input,
  Tab,
  Tabs,
  Tooltip
} from '@heroui/react'
import React, { useState, useEffect, useRef } from 'react'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { getGistUrl, getUserAgent } from '@renderer/utils/ipc'
import debounce from '@renderer/utils/debounce'
import { IoIosHelpCircle } from 'react-icons/io'
import { BiCopy } from 'react-icons/bi'

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
    githubToken = ''
  } = appConfig || {}

  const [ua, setUa] = useState(userAgent ?? '')
  const [defaultUserAgent, setDefaultUserAgent] = useState<string>('')
  const userAgentFetched = useRef(false)

  const setUaDebounce = debounce((v: string) => {
    patchAppConfig({ userAgent: v })
  }, 500)

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
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="md"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="flag-emoji">
        <ModalHeader className="flex pb-0">订阅设置</ModalHeader>
        <ModalBody className="py-2 gap-1">
          <SettingItem title="显示日期" divider>
            <Tabs
              size="sm"
              color="primary"
              selectedKey={profileDisplayDate}
              onSelectionChange={async (v) => {
                await patchAppConfig({
                  profileDisplayDate: v as 'expire' | 'update'
                })
              }}
            >
              <Tab key="update" title="更新时间" />
              <Tab key="expire" title="到期时间" />
            </Tabs>
          </SettingItem>
          <SettingItem
            title="为不同订阅分别指定工作目录"
            actions={
              <Tooltip content="开启后可以避免不同订阅中存在相同代理组名时无法分别保存选择的节点">
                <Button isIconOnly size="sm" variant="light">
                  <IoIosHelpCircle className="text-lg" />
                </Button>
              </Tooltip>
            }
            divider
          >
            <Switch
              size="sm"
              isSelected={diffWorkDir}
              onValueChange={(v) => {
                patchAppConfig({ diffWorkDir: v })
              }}
            />
          </SettingItem>
          <SettingItem title="订阅拉取 UA" divider>
            <Input
              size="sm"
              className="w-[60%]"
              value={ua}
              placeholder={`默认 ${defaultUserAgent}`}
              onValueChange={(v) => {
                setUa(v)
                setUaDebounce(v)
              }}
            />
          </SettingItem>
          <SettingItem
            title="同步运行时配置到 Gist"
            actions={
              <Button
                title="复制 Gist URL"
                isIconOnly
                size="sm"
                variant="light"
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
            }
          >
            <Input
              type="password"
              size="sm"
              className="w-[60%]"
              value={githubToken}
              placeholder="GitHub Token"
              onValueChange={(v) => {
                patchAppConfig({ githubToken: v })
              }}
            />
          </SettingItem>
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ProfileSettingModal
