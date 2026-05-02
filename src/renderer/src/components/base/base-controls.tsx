import { Tabs } from '@heroui-v3/react'
import type React from 'react'
import type { SettingItemProps } from './base-setting-item'

export const settingItemProps = {
  variant: 'compact',
  contentAlign: 'end'
} satisfies Pick<SettingItemProps, 'variant' | 'contentAlign'>

interface SettingTabOption {
  id: string
  label: string
}

interface SettingTabsProps {
  ariaLabel: string
  selectedKey: string
  options: SettingTabOption[]
  onChange: (key: string) => void | Promise<void>
}

export const SettingTabs: React.FC<SettingTabsProps> = (props) => {
  const { ariaLabel, selectedKey, options, onChange } = props

  return (
    <Tabs selectedKey={selectedKey} onSelectionChange={(key) => void onChange(String(key))}>
      <Tabs.ListContainer>
        <Tabs.List aria-label={ariaLabel}>
          {options.map((option) => (
            <Tabs.Tab key={option.id} id={option.id}>
              {option.label}
              <Tabs.Indicator />
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  )
}
