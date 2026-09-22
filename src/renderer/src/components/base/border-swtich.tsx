import React from 'react'
import { cn, Switch, type SwitchProps } from '@heroui/react'

interface SiderSwitchProps extends SwitchProps {
  isShowBorder?: boolean
  onValueChange?: (selected: boolean) => void
}

const BorderSwitch: React.FC<SiderSwitchProps> = ({
  isShowBorder = false,
  onValueChange,
  className,
  ...switchProps
}) => (
  <Switch
    {...switchProps}
    className={cn('border-switch flex-row items-center px-2', className)}
    size="sm"
    onChange={onValueChange}
    aria-label="启用"
  >
    <Switch.Content aria-label="启用">
      <Switch.Control
        className={cn(
          'border-2',
          isShowBorder ? 'border-primary-foreground' : 'border-transparent'
        )}
      >
        <Switch.Thumb />
      </Switch.Control>
    </Switch.Content>
  </Switch>
)

export default BorderSwitch
