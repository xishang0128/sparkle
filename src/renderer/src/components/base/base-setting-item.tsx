import { cn, Divider } from '@heroui/react'

import React from 'react'

export interface SettingItemProps {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
  compatKey?: string
  align?: 'start' | 'center'
  variant?: 'default' | 'compact'
  contentAlign?: 'start' | 'end'
}

const SettingItem: React.FC<SettingItemProps> = (props) => {
  const {
    title,
    actions,
    children,
    divider = false,
    compatKey,
    align = 'center',
    variant = 'default',
    contentAlign = 'start'
  } = props
  const isCompact = variant === 'compact'

  return (
    <>
      {compatKey ? (
        <div className="select-text h-8 w-full flex justify-between">
          <div className="h-full flex items-center">
            <h4 className="h-full text-md leading-8 whitespace-nowrap">{title}</h4>
            <div>{actions}</div>
          </div>
          {children}
        </div>
      ) : (
        <div
          className={cn(
            'setting-item select-text',
            align === 'start' ? 'setting-item--start' : 'setting-item--center',
            isCompact && 'setting-item--compact',
            contentAlign === 'end' && 'setting-item--content-end'
          )}
        >
          <div className="setting-item__title-wrap">
            <h4 className="setting-item__title">{title}</h4>
            {actions}
          </div>
          <div className="setting-item__content">{children}</div>
        </div>
      )}
      {divider && <Divider className="my-2" />}
    </>
  )
}

export default SettingItem
