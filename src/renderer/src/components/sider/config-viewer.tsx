import { Button, Label, Modal, Separator, Switch } from '@heroui-v3/react'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { BaseEditor } from '../base/base-editor-lazy'
import {
  getProfileConfig,
  getRawProfileStr,
  getRuntimeConfigStr,
  getCurrentProfileStr,
  getOverrideProfileStr
} from '@renderer/utils/ipc'
import useSWR from 'swr'

interface Props {
  onClose: () => void
}

type CompareTarget = 'profile' | 'raw' | 'override'

const ConfigViewer: React.FC<Props> = ({ onClose }) => {
  const [runtimeConfig, setRuntimeConfig] = useState('')
  const [rawProfile, setRawProfile] = useState('')
  const [profileConfig, setProfileConfig] = useState('')
  const [overrideConfig, setOverrideConfig] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDiff, setIsDiff] = useState(false)
  const [compareTarget, setCompareTarget] = useState<CompareTarget>('profile')
  const [sideBySide, setSideBySide] = useState(false)
  const skipNextConfigRefreshRef = useRef(true)

  const { data: config } = useSWR('getProfileConfig', getProfileConfig)

  const fetchConfigs = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage('')

    const [runtimeResult, rawResult, profileResult, overrideResult] = await Promise.allSettled([
      getRuntimeConfigStr(),
      getRawProfileStr(),
      getCurrentProfileStr(),
      getOverrideProfileStr()
    ])

    const failedTargets: string[] = []

    if (runtimeResult.status === 'fulfilled') {
      setRuntimeConfig(runtimeResult.value)
    } else {
      failedTargets.push('运行时配置')
    }

    if (rawResult.status === 'fulfilled') {
      setRawProfile(rawResult.value)
    } else {
      failedTargets.push('原始配置')
    }

    if (profileResult.status === 'fulfilled') {
      setProfileConfig(profileResult.value)
    } else {
      failedTargets.push('当前配置')
    }

    if (overrideResult.status === 'fulfilled') {
      setOverrideConfig(overrideResult.value)
    } else {
      failedTargets.push('覆写后配置')
    }

    if (failedTargets.length > 0) {
      setErrorMessage(`部分内容读取失败：${failedTargets.join('、')}`)
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  useEffect(() => {
    if (config === undefined) return
    if (skipNextConfigRefreshRef.current) {
      skipNextConfigRefreshRef.current = false
      return
    }
    fetchConfigs()
  }, [config, fetchConfigs])

  const originalValue = !isDiff
    ? undefined
    : compareTarget === 'override'
      ? overrideConfig
      : compareTarget === 'raw'
        ? rawProfile
        : profileConfig

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container>
          <Modal.Dialog className="mt-4 h-[calc(100%-32px)] max-w-none">
            <Modal.Header className="app-drag pb-0">
              <Modal.Heading>当前运行时配置</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="h-full">
              {errorMessage && <div className="px-1 pb-2 text-sm text-warning">{errorMessage}</div>}
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  正在读取配置...
                </div>
              ) : (
                <BaseEditor
                  language="yaml"
                  value={runtimeConfig}
                  originalValue={originalValue}
                  readOnly
                  diffRenderSideBySide={sideBySide}
                />
              )}
            </Modal.Body>
            <Modal.Footer className="pt-0 pb-0 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Switch size="md" isSelected={isDiff} onChange={setIsDiff}>
                  <Switch.Content>
                    <Label>对比当前配置</Label>
                  </Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
                <Separator orientation="vertical" />
                <Switch
                  size="sm"
                  isDisabled={!isDiff}
                  isSelected={sideBySide}
                  onChange={setSideBySide}
                >
                  <Switch.Content>
                    <Label>侧边显示</Label>
                  </Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
                <Separator orientation="vertical" />
                <Switch
                  size="sm"
                  isDisabled={!isDiff}
                  isSelected={compareTarget === 'raw'}
                  onChange={(value) => {
                    setCompareTarget(value ? 'raw' : 'profile')
                  }}
                >
                  <Switch.Content>
                    <Label>显示原始文本</Label>
                  </Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
                <Separator orientation="vertical" />
                <Switch
                  size="sm"
                  isDisabled={!isDiff}
                  isSelected={compareTarget === 'override'}
                  onChange={(value) => {
                    setCompareTarget(value ? 'override' : 'profile')
                  }}
                >
                  <Switch.Content>
                    <Label>显示覆写后文本</Label>
                  </Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 min-w-0 px-3 text-sm leading-none"
                onPress={onClose}
              >
                关闭
              </Button>
            </Modal.Footer>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ConfigViewer
