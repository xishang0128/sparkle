import { Tabs } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useGroups } from '@renderer/hooks/use-groups'
import { mihomoCloseConnections, patchMihomoConfig } from '@renderer/utils/ipc'

interface Props {
  iconOnly?: boolean
  expanded?: boolean
}

const OutboundModeSwitcher: React.FC<Props> = ({ iconOnly, expanded = false }: Props) => {
  const { controledMihomoConfig, patchControledMihomoConfig } = useControledMihomoConfig()
  const { mutate: mutateGroups } = useGroups()
  const { appConfig } = useAppConfig()
  const { autoCloseConnection = true } = appConfig || {}
  const { mode } = controledMihomoConfig || {}

  const onChangeMode = async (mode: OutboundMode): Promise<void> => {
    await patchControledMihomoConfig({ mode })
    await patchMihomoConfig({ mode })
    if (autoCloseConnection) {
      await mihomoCloseConnections()
    }
    mutateGroups()
    window.electron.ipcRenderer.send('updateTrayMenu')
  }
  if (!mode) return null
  return (
    <Tabs
      orientation={iconOnly ? 'vertical' : 'horizontal'}
      selectedKey={mode}
      onSelectionChange={(key) => onChangeMode(key as OutboundMode)}
      data-color="primary"
      data-size="md"
      data-full-width
      className={iconOnly ? 'sider-outbound-modes' : undefined}
    >
      <Tabs.List aria-label="出站模式" className="bg-content1 shadow-medium outbound-mode-card">
        {[
          { id: 'rule', label: '规则', shortLabel: 'R' },
          { id: 'global', label: '全局', shortLabel: 'G' },
          { id: 'direct', label: '直连', shortLabel: 'D' }
        ].map((option) => (
          <Tabs.Tab
            key={option.id}
            id={option.id}
            className={mode === option.id ? 'font-bold' : ''}
          >
            {iconOnly ? (
              <>
                <span className="sider-mode-icon">{option.shortLabel}</span>
                <span className="sider-item-label" aria-hidden={!expanded}>
                  {option.label}
                </span>
              </>
            ) : (
              option.label
            )}
            <Tabs.Indicator />
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  )
}

export default OutboundModeSwitcher
