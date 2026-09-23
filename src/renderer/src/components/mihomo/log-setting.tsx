import { Button, Tooltip, InputGroup, Select, Switch, ListBox } from '@heroui/react'

import { useEffect, useState } from 'react'
import { IoIosHelpCircle } from 'react-icons/io'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { restartCore } from '@renderer/utils/ipc'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'

const LogSetting: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const {
    saveLogs = true,
    maxLogDays = 7,
    maxLogFileSizeMB = 20,
    maxLogEntries = 500
  } = appConfig || {}
  const { 'log-level': logLevel = 'info' } = controledMihomoConfig || {}

  const [maxLogDaysInput, setMaxLogDaysInput] = useState(maxLogDays)
  const [maxLogFileSizeMBInput, setMaxLogFileSizeMBInput] = useState(maxLogFileSizeMB)
  const [maxLogEntriesInput, setMaxLogEntriesInput] = useState(maxLogEntries)

  useEffect(() => {
    setMaxLogDaysInput(maxLogDays)
  }, [maxLogDays])

  useEffect(() => {
    setMaxLogFileSizeMBInput(maxLogFileSizeMB)
  }, [maxLogFileSizeMB])

  useEffect(() => {
    setMaxLogEntriesInput(maxLogEntries)
  }, [maxLogEntries])

  const onChangeNeedRestart = async (patch: Partial<MihomoConfig>): Promise<void> => {
    await patchControledMihomoConfig(patch)
    await restartCore()
  }

  return (
    <SettingCard header="日志设置">
      <SettingItem
        compatKey="legacy"
        title="保存日志"
        actions={
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>
              {'关闭后将停止写入本地日志文件，实时日志页面仍可继续查看当前会话日志'}
            </Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={saveLogs}
          onChange={(value) => {
            patchAppConfig({ saveLogs: value })
          }}
          aria-label="保存日志"
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </SettingItem>
      <SettingItem compatKey="legacy" title="日志保留天数" divider>
        <div className="flex">
          {saveLogs && maxLogDaysInput !== maxLogDays && (
            <Button
              size="sm"
              onPress={() => {
                patchAppConfig({ maxLogDays: maxLogDaysInput })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <InputGroup className="w-25" isDisabled={!saveLogs} fullWidth>
            <InputGroup.Input
              type="number"
              value={maxLogDaysInput.toString()}
              min={1}
              onChange={(event) => {
                const value = event.target.value
                setMaxLogDaysInput(Math.max(parseInt(value) || 0, 1))
              }}
              disabled={!saveLogs}
            />
            <InputGroup.Suffix>{'天'}</InputGroup.Suffix>
          </InputGroup>
        </div>
      </SettingItem>
      <SettingItem
        compatKey="legacy"
        title="单文件日志上限"
        actions={
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>
              {'仅影响本地日志文件，超过大小上限后会自动删除最早的日志行'}
            </Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <div className="flex">
          {saveLogs && maxLogFileSizeMBInput !== maxLogFileSizeMB && (
            <Button
              size="sm"
              onPress={() => {
                patchAppConfig({ maxLogFileSizeMB: maxLogFileSizeMBInput })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <InputGroup className="w-25" isDisabled={!saveLogs} fullWidth>
            <InputGroup.Input
              type="number"
              value={maxLogFileSizeMBInput.toString()}
              min={1}
              onChange={(event) => {
                const value = event.target.value
                setMaxLogFileSizeMBInput(Math.max(parseInt(value) || 0, 1))
              }}
              disabled={!saveLogs}
            />
            <InputGroup.Suffix>{'MB'}</InputGroup.Suffix>
          </InputGroup>
        </div>
      </SettingItem>
      <SettingItem
        compatKey="legacy"
        title="实时日志缓存数"
        actions={
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" data-color="default">
              <IoIosHelpCircle className="text-lg" />
            </Button>
            <Tooltip.Content>
              {'仅影响应用内实时日志页面保留的条数，不影响本地日志文件'}
            </Tooltip.Content>
          </Tooltip>
        }
        divider
      >
        <div className="flex">
          {maxLogEntriesInput !== maxLogEntries && (
            <Button
              size="sm"
              onPress={() => {
                patchAppConfig({ maxLogEntries: maxLogEntriesInput })
              }}
              variant="primary"
              data-color="primary"
              className="mr-2"
            >
              确认
            </Button>
          )}
          <InputGroup className="w-25" fullWidth>
            <InputGroup.Input
              type="number"
              value={maxLogEntriesInput.toString()}
              min={1}
              onChange={(event) => {
                const value = event.target.value
                setMaxLogEntriesInput(Math.max(parseInt(value) || 0, 1))
              }}
            />
            <InputGroup.Suffix>{'条'}</InputGroup.Suffix>
          </InputGroup>
        </div>
      </SettingItem>
      <SettingItem compatKey="legacy" title="日志等级">
        <Select
          aria-label="日志等级"
          className={['w-25'].filter(Boolean).join(' ')}
          data-size="sm"
          value={logLevel ?? null}
          onChange={(value) => onChangeNeedRestart({ 'log-level': value as LogLevel })}
        >
          <Select.Trigger className="data-[hover=true]:bg-default-200">
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover placement="bottom" shouldFlip containerPadding={56}>
            <ListBox>
              <ListBox.Item key="silent" id="silent" textValue="静默">
                静默
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="error" id="error" textValue="错误">
                错误
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="warning" id="warning" textValue="警告">
                警告
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="info" id="info" textValue="信息">
                信息
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item key="debug" id="debug" textValue="调试">
                调试
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </SettingItem>
    </SettingCard>
  )
}

export default LogSetting
