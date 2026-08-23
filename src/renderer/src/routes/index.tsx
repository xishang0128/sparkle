import { useLayoutEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { markInitialContentPartReady } from '@renderer/utils/startup'
import {
  Connections,
  DNS,
  Logs,
  Mihomo,
  Override,
  Profiles,
  Proxies,
  Resources,
  Rules,
  Settings,
  Sniffer,
  SubStore,
  Sysproxy,
  Tun
} from './route-pages'

export { useDeferredRoutePreload } from './route-pages'

function StartupRoute({ children }: { children: ReactNode }): ReactNode {
  useLayoutEffect(() => {
    markInitialContentPartReady('route')
  }, [])
  return children
}

function startupRoute(element: ReactNode): ReactNode {
  return <StartupRoute>{element}</StartupRoute>
}

const routes = [
  {
    path: '/mihomo',
    element: startupRoute(<Mihomo />)
  },
  {
    path: '/sysproxy',
    element: startupRoute(<Sysproxy />)
  },
  {
    path: '/tun',
    element: startupRoute(<Tun />)
  },
  {
    path: '/proxies',
    element: startupRoute(<Proxies />)
  },
  {
    path: '/rules',
    element: startupRoute(<Rules />)
  },
  {
    path: '/resources',
    element: startupRoute(<Resources />)
  },
  {
    path: '/dns',
    element: startupRoute(<DNS />)
  },
  {
    path: '/sniffer',
    element: startupRoute(<Sniffer />)
  },
  {
    path: '/logs',
    element: startupRoute(<Logs />)
  },
  {
    path: '/connections',
    element: startupRoute(<Connections />)
  },
  {
    path: '/override',
    element: startupRoute(<Override />)
  },
  {
    path: '/profiles',
    element: startupRoute(<Profiles />)
  },
  {
    path: '/settings',
    element: startupRoute(<Settings />)
  },
  {
    path: '/substore',
    element: startupRoute(<SubStore />)
  },
  {
    path: '/',
    element: <Navigate to="/proxies" />
  }
]

export default routes
