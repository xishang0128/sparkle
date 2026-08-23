import { useEffect } from 'react'
import { onInitialContentReady } from '@renderer/utils/startup'
import { createPreloadablePage } from './preloadable-page'

const OverridePage = createPreloadablePage(() => import('@renderer/pages/override'))
const ProxiesPage = createPreloadablePage(() => import('@renderer/pages/proxies'))
const RulesPage = createPreloadablePage(() => import('@renderer/pages/rules'))
const SettingsPage = createPreloadablePage(() => import('@renderer/pages/settings'))
const ProfilesPage = createPreloadablePage(() => import('@renderer/pages/profiles'))
const LogsPage = createPreloadablePage(() => import('@renderer/pages/logs'))
const ConnectionsPage = createPreloadablePage(() => import('@renderer/pages/connections'))
const MihomoPage = createPreloadablePage(() => import('@renderer/pages/mihomo'))
const SysproxyPage = createPreloadablePage(() => import('@renderer/pages/syspeoxy'))
const TunPage = createPreloadablePage(() => import('@renderer/pages/tun'))
const ResourcesPage = createPreloadablePage(() => import('@renderer/pages/resources'))
const DNSPage = createPreloadablePage(() => import('@renderer/pages/dns'))
const SnifferPage = createPreloadablePage(() => import('@renderer/pages/sniffer'))
const SubStorePage = createPreloadablePage(() => import('@renderer/pages/substore'))

export const Override = OverridePage.Page
export const Proxies = ProxiesPage.Page
export const Rules = RulesPage.Page
export const Settings = SettingsPage.Page
export const Profiles = ProfilesPage.Page
export const Logs = LogsPage.Page
export const Connections = ConnectionsPage.Page
export const Mihomo = MihomoPage.Page
export const Sysproxy = SysproxyPage.Page
export const Tun = TunPage.Page
export const Resources = ResourcesPage.Page
export const DNS = DNSPage.Page
export const Sniffer = SnifferPage.Page
export const SubStore = SubStorePage.Page

void ProxiesPage.preload().catch(() => {})

const remainingPageLoaders: Array<() => Promise<unknown>> = [
  SettingsPage.preload,
  ProfilesPage.preload,
  ConnectionsPage.preload,
  RulesPage.preload,
  MihomoPage.preload,
  SysproxyPage.preload,
  TunPage.preload,
  DNSPage.preload,
  SnifferPage.preload,
  ResourcesPage.preload,
  OverridePage.preload,
  LogsPage.preload,
  SubStorePage.preload
]
let remainingPagesPromise: Promise<void> | undefined

function preloadRemainingPages(): Promise<void> {
  if (remainingPagesPromise) return remainingPagesPromise

  let nextLoader = 0
  const preloadNext = async (): Promise<void> => {
    while (nextLoader < remainingPageLoaders.length) {
      const loader = remainingPageLoaders[nextLoader++]
      try {
        await loader()
      } catch {
        // A failed page import is retried when the route is opened.
      }
    }
  }
  remainingPagesPromise = Promise.all([preloadNext(), preloadNext()]).then(() => undefined)
  return remainingPagesPromise
}

export function useDeferredRoutePreload(): void {
  useEffect(() => {
    let frame: number | undefined
    let idleCallback: number | undefined
    const unsubscribe = onInitialContentReady(() => {
      frame = window.requestAnimationFrame(() => {
        idleCallback = window.requestIdleCallback(() => void preloadRemainingPages(), {
          timeout: 1500
        })
      })
    })

    return (): void => {
      unsubscribe()
      if (frame !== undefined) window.cancelAnimationFrame(frame)
      if (idleCallback !== undefined) window.cancelIdleCallback(idleCallback)
    }
  }, [])
}
