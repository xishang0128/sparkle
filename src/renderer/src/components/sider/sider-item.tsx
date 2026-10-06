import { Button } from '@heroui/react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

interface Props {
  title: string
  route: string
  icon: ReactNode
  className?: string
  expanded?: boolean
  children?: ReactNode
}

export default function SiderItem({
  title,
  route,
  icon,
  className = '',
  expanded = false,
  children
}: Props): React.JSX.Element {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = pathname.includes(route)

  return (
    <div
      data-expanded={expanded}
      className={`${className} sider-item mx-2 flex h-8 shrink-0 items-center rounded-lg ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
    >
      <Button
        size="sm"
        aria-label={title}
        aria-current={active ? 'page' : undefined}
        onPress={() => navigate(route)}
        variant="ghost"
        className={`h-8 min-w-0 flex-1 justify-start gap-0 p-0 bg-transparent ${active ? 'text-primary-foreground' : ''}`}
      >
        <span
          style={{ width: 'var(--sider-icon-width, 44px)' }}
          className="flex h-full shrink-0 items-center justify-center"
        >
          {icon}
        </span>
        <span className="sider-item-label truncate text-sm" aria-hidden={!expanded}>
          {title}
        </span>
      </Button>
      {children && (
        <div className="sider-item-action" inert={!expanded} aria-hidden={!expanded}>
          {children}
        </div>
      )}
    </div>
  )
}
