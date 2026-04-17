import { cn, Divider } from '@heroui/react'

import React from 'react'

interface Props {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
  compatKey?: string
  align?: 'start' | 'center'
}

const SettingItem: React.FC<Props> = (props) => {
  const { title, actions, children, divider = false, compatKey, align = 'center' } = props

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
            'select-text grid w-full grid-cols-[100px_minmax(0,1fr)] gap-x-3 gap-y-2 py-2',
            align === 'start' ? 'items-start' : 'items-center'
          )}
        >
          <div className="flex min-h-9 items-center gap-2">
            <h4 className="text-sm leading-6 whitespace-nowrap text-foreground-500">{title}</h4>
            {actions}
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      )}
      {divider && <Divider className="my-2" />}
    </>
  )
}

export default SettingItem
