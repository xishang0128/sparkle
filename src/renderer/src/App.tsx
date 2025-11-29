import { useTheme } from 'next-themes'
import { useEffect, useRef, useState } from 'react'
import { NavigateFunction, useLocation, useNavigate, useRoutes } from 'react-router-dom'
import OutboundModeSwitcher from '@renderer/components/sider/outbound-mode-switcher'
import SysproxySwitcher from '@renderer/components/sider/sysproxy-switcher'
import TunSwitcher from '@renderer/components/sider/tun-switcher'
import { Button, Divider } from '@heroui/react'
import { IoSettings } from 'react-icons/io5'
import routes from '@renderer/routes'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import ProfileCard from '@renderer/components/sider/profile-card'
import ProxyCard from '@renderer/components/sider/proxy-card'
import RuleCard from '@renderer/components/sider/rule-card'
import DNSCard from '@renderer/components/sider/dns-card'
import SniffCard from '@renderer/components/sider/sniff-card'
import OverrideCard from '@renderer/components/sider/override-card'
import ConnCard from '@renderer/components/sider/conn-card'
import LogCard from '@renderer/components/sider/log-card'
import MihomoCoreCard from '@renderer/components/sider/mihomo-core-card'
import ResourceCard from '@renderer/components/sider/resource-card'
import UpdaterButton from '@renderer/components/updater/updater-button'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { applyTheme, checkUpdate, setNativeTheme, setTitleBarOverlay } from '@renderer/utils/ipc'
import { platform } from '@renderer/utils/init'
import { TitleBarOverlayOptions } from 'electron'
import SubStoreCard from '@renderer/components/sider/substore-card'
import MihomoIcon from './components/base/mihomo-icon'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import useSWR from 'swr'
import ConfirmModal from '@renderer/components/base/base-confirm'

let navigate: NavigateFunction

const App: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    appTheme = 'system',
    customTheme,
    useWindowFrame = false,
    siderWidth = 250,
    siderOrder = [
      'sysproxy',
      'tun',
      'dns',
      'sniff',
      'proxy',
      'connection',
      'profile',
      'mihomo',
      'rule',
      'resource',
      'override',
      'log',
      'substore'
    ],
    autoCheckUpdate,
    updateChannel = 'stable',
    disableAnimation = false
  } = appConfig || {}
  const narrowWidth = platform === 'darwin' ? 70 : 60
  const [order, setOrder] = useState(siderOrder)
  const [siderWidthValue, setSiderWidthValue] = useState(siderWidth)
  const siderWidthValueRef = useRef(siderWidthValue)
  const [resizing, setResizing] = useState(false)
  const resizingRef = useRef(resizing)
  const sensors = useSensors(useSensor(PointerSensor))
  const { setTheme, systemTheme } = useTheme()
  navigate = useNavigate()
  const location = useLocation()
  const page = useRoutes(routes)
  const setTitlebar = (): void => {
    if (!useWindowFrame) {
      const options = { height: 48 } as TitleBarOverlayOptions
      try {
        if (platform !== 'darwin') {
          options.color = window.getComputedStyle(document.documentElement).backgroundColor
          options.symbolColor = window.getComputedStyle(document.documentElement).color
        }
        setTitleBarOverlay(options)
      } catch (e) {
        // ignore
      }
    }
  }
  const { data: latest } = useSWR(
    autoCheckUpdate ? ['checkUpdate', updateChannel] : undefined,
    autoCheckUpdate ? checkUpdate : (): undefined => {},
    {
      refreshInterval: 1000 * 60 * 10
    }
  )

  useEffect(() => {
    setOrder(siderOrder)
    setSiderWidthValue(siderWidth)
  }, [siderOrder, siderWidth])

  useEffect(() => {
    siderWidthValueRef.current = siderWidthValue
    resizingRef.current = resizing
  }, [siderWidthValue, resizing])

  useEffect(() => {
    const tourShown = window.localStorage.getItem('tourShown')
    if (!tourShown) {
      window.localStorage.setItem('tourShown', 'true')
      firstDriver.drive()
    }
  }, [])

  useEffect(() => {
    setNativeTheme(appTheme)
    setTheme(appTheme)
    setTitlebar()
  }, [appTheme, systemTheme])

  useEffect(() => {
    applyTheme(customTheme || 'default.css').then(() => {
      setTitlebar()
    })
  }, [customTheme])

  useEffect(() => {
    window.addEventListener('mouseup', onResizeEnd)
    return (): void => window.removeEventListener('mouseup', onResizeEnd)
  }, [])

  const onResizeEnd = (): void => {
    if (resizingRef.current) {
      setResizing(false)
      patchAppConfig({ siderWidth: siderWidthValueRef.current })
    }
  }

  const onDragEnd = async (event: DragEndEvent): Promise<void> => {
    const { active, over } = event
    if (over) {
      if (active.id !== over.id) {
        const newOrder = order.slice()
        const activeIndex = newOrder.indexOf(active.id as string)
        const overIndex = newOrder.indexOf(over.id as string)
        newOrder.splice(activeIndex, 1)
        newOrder.splice(overIndex, 0, active.id as string)
        setOrder(newOrder)
        await patchAppConfig({ siderOrder: newOrder })
        return
      }
    }
    navigate(navigateMap[active.id as string])
  }

  const navigateMap = {
    sysproxy: 'sysproxy',
    tun: 'tun',
    profile: 'profiles',
    proxy: 'proxies',
    mihomo: 'mihomo',
    connection: 'connections',
    dns: 'dns',
    sniff: 'sniffer',
    log: 'logs',
    rule: 'rules',
    resource: 'resources',
    override: 'override',
    substore: 'substore'
  }

  const componentMap = {
    sysproxy: SysproxySwitcher,
    tun: TunSwitcher,
    profile: ProfileCard,
    proxy: ProxyCard,
    mihomo: MihomoCoreCard,
    connection: ConnCard,
    dns: DNSCard,
    sniff: SniffCard,
    log: LogCard,
    rule: RuleCard,
    resource: ResourceCard,
    override: OverrideCard,
    substore: SubStoreCard
  }

  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showProfileInstallConfirm, setShowProfileInstallConfirm] = useState(false)
  const [showOverrideInstallConfirm, setShowOverrideInstallConfirm] = useState(false)
  const [profileInstallData, setProfileInstallData] = useState<{
    url: string
    name?: string | null
  }>()
  const [overrideInstallData, setOverrideInstallData] = useState<{
    url: string
    name?: string | null
  }>()

  useEffect(() => {
    const handleShowQuitConfirm = (): void => {
      setShowQuitConfirm(true)
    }
    const handleShowProfileInstallConfirm = (
      _event: unknown,
      data: { url: string; name?: string | null }
    ): void => {
      setProfileInstallData(data)
      setShowProfileInstallConfirm(true)
    }
    const handleShowOverrideInstallConfirm = (
      _event: unknown,
      data: { url: string; name?: string | null }
    ): void => {
      setOverrideInstallData(data)
      setShowOverrideInstallConfirm(true)
    }

    window.electron.ipcRenderer.on('show-quit-confirm', handleShowQuitConfirm)
    window.electron.ipcRenderer.on('show-profile-install-confirm', handleShowProfileInstallConfirm)
    window.electron.ipcRenderer.on(
      'show-override-install-confirm',
      handleShowOverrideInstallConfirm
    )

    return (): void => {
      window.electron.ipcRenderer.removeAllListeners('show-quit-confirm')
      window.electron.ipcRenderer.removeAllListeners('show-profile-install-confirm')
      window.electron.ipcRenderer.removeAllListeners('show-override-install-confirm')
    }
  }, [])

  const handleQuitConfirm = (confirmed: boolean): void => {
    setShowQuitConfirm(false)
    window.electron.ipcRenderer.send('quit-confirm-result', confirmed)
  }

  const handleProfileInstallConfirm = (confirmed: boolean): void => {
    setShowProfileInstallConfirm(false)
    window.electron.ipcRenderer.send('profile-install-confirm-result', confirmed)
  }

  const handleOverrideInstallConfirm = (confirmed: boolean): void => {
    setShowOverrideInstallConfirm(false)
    window.electron.ipcRenderer.send('override-install-confirm-result', confirmed)
  }

  return (
    <div
      onMouseMove={(e) => {
        if (!resizing) return
        if (e.clientX <= 150) {
          setSiderWidthValue(narrowWidth)
        } else if (e.clientX <= 250) {
          setSiderWidthValue(250)
        } else if (e.clientX >= 400) {
          setSiderWidthValue(400)
        } else {
          setSiderWidthValue(e.clientX)
        }
      }}
      className={`w-full h-screen flex ${resizing ? 'cursor-ew-resize' : ''}`}
    >
      {showQuitConfirm && (
        <ConfirmModal
          title="确定要退出 Sparkle 吗？"
          description={
            <div>
              <p></p>
              <p className="text-sm text-gray-500 mt-2">退出后代理功能将停止工作</p>
            </div>
          }
          confirmText="退出"
          cancelText="取消"
          onChange={(open) => {
            if (!open) {
              handleQuitConfirm(false)
            }
          }}
          onConfirm={() => handleQuitConfirm(true)}
        />
      )}
      {showProfileInstallConfirm && profileInstallData && (
        <ConfirmModal
          title="确定要导入订阅配置吗？"
          description={
            <div>
              <p className="text-sm text-gray-600 mb-2">
                名称：{profileInstallData.name || '未命名'}
              </p>
              <p className="text-sm text-gray-600 mb-2">链接：{profileInstallData.url}</p>
              <p className="text-sm text-orange-500 mt-2">
                请确保订阅配置来源可信，恶意配置可能影响您的网络安全
              </p>
            </div>
          }
          confirmText="导入"
          cancelText="取消"
          onChange={(open) => {
            if (!open) {
              handleProfileInstallConfirm(false)
            }
          }}
          onConfirm={() => handleProfileInstallConfirm(true)}
        />
      )}
      {showOverrideInstallConfirm && overrideInstallData && (
        <ConfirmModal
          title="确定要导入覆写文件吗？"
          description={
            <div>
              <p className="text-sm text-gray-600 mb-2">
                名称：{overrideInstallData.name || '未命名'}
              </p>
              <p className="text-sm text-gray-600 mb-2">链接：{overrideInstallData.url}</p>
              <p className="text-sm text-orange-500 mt-2">
                请确保覆写文件来源可信，恶意覆写文件可能影响您的网络安全
              </p>
            </div>
          }
          confirmText="导入"
          cancelText="取消"
          onChange={(open) => {
            if (!open) {
              handleOverrideInstallConfirm(false)
            }
          }}
          onConfirm={() => handleOverrideInstallConfirm(true)}
        />
      )}
      {siderWidthValue === narrowWidth ? (
        <div style={{ width: `${narrowWidth}px` }} className="side h-full">
          <div className="app-drag flex justify-center items-center z-40 bg-transparent h-[45px]">
            {platform !== 'darwin' && (
              <MihomoIcon className="h-[32px] leading-[32px] text-lg mx-px" />
            )}
          </div>
          <div
            className={`${latest ? 'h-[calc(100%-275px)]' : 'h-[calc(100%-227px)]'} overflow-y-auto no-scrollbar`}
          >
            <div className="h-full w-full flex flex-col gap-2">
              {order.map((key: string) => {
                const Component = componentMap[key]
                if (!Component) return null
                return <Component key={key} iconOnly={true} />
              })}
            </div>
          </div>
          <div className="p-2 flex flex-col items-center space-y-2">
            {latest && latest.version && <UpdaterButton iconOnly={true} latest={latest} />}
            <OutboundModeSwitcher iconOnly />
            <Button
              size="sm"
              className="app-nodrag"
              isIconOnly
              color={location.pathname.includes('/settings') ? 'primary' : 'default'}
              variant={location.pathname.includes('/settings') ? 'solid' : 'light'}
              onPress={() => navigate('/settings')}
            >
              <IoSettings className="text-[20px]" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          style={{ width: `${siderWidthValue}px` }}
          className="side h-full overflow-y-auto overflow-x-hidden no-scrollbar"
        >
          <div
            className={`app-drag sticky top-0 z-40 ${disableAnimation ? 'bg-background/95 backdrop-blur-sm' : 'bg-transparent backdrop-blur'} h-[49px]`}
          >
            <div
              className={`flex justify-between p-2 ${!useWindowFrame && platform === 'darwin' ? 'ml-[60px]' : ''}`}
            >
              <div className="flex ml-1">
                <h3 className="text-lg font-bold leading-[32px]">Sparkle</h3>
              </div>
              {latest && latest.version && <UpdaterButton latest={latest} />}
              <Button
                size="sm"
                className="app-nodrag"
                isIconOnly
                color={location.pathname.includes('/settings') ? 'primary' : 'default'}
                variant={location.pathname.includes('/settings') ? 'solid' : 'light'}
                onPress={() => {
                  navigate('/settings')
                }}
              >
                <IoSettings className="text-[20px]" />
              </Button>
            </div>
          </div>
          <div className="mt-2 mx-2">
            <OutboundModeSwitcher />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
            <div className="grid grid-cols-2 gap-2 m-2 overflow-hidden">
              <SortableContext items={order}>
                {order.map((key: string) => {
                  const Component = componentMap[key]
                  if (!Component) return null
                  return <Component key={key} />
                })}
              </SortableContext>
            </div>
          </DndContext>
        </div>
      )}

      <div
        onMouseDown={() => {
          setResizing(true)
        }}
        style={{
          position: 'fixed',
          zIndex: 50,
          left: `${siderWidthValue - 2}px`,
          width: '5px',
          height: '100vh',
          cursor: 'ew-resize'
        }}
        className={resizing ? 'bg-primary' : ''}
      />
      <Divider orientation="vertical" />
      <div
        style={{ width: `calc(100% - ${siderWidthValue + 1}px)` }}
        className="main grow h-full overflow-y-auto"
      >
        {page}
      </div>
    </div>
  )
}

export default App

export const firstDriver = driver({
  showProgress: true,
  nextBtnText: '下一步',
  prevBtnText: '上一步',
  doneBtnText: '完成',
  progressText: '{{current}} / {{total}}',
  overlayOpacity: 0.9,
  steps: [
    {
      element: 'none',
      popover: {
        title: '欢迎使用 Sparkle',
        description:
          '这是一份交互式使用教程，如果您已经完全熟悉本软件的操作，可以直接点击右上角关闭按钮，后续您可以随时从设置中打开本教程',
        side: 'over',
        align: 'center'
      }
    },
    {
      element: '.side',
      popover: {
        title: '导航栏',
        description:
          '左侧是应用的导航栏，兼顾仪表盘功能，在这里可以切换不同页面，也可以概览常用的状态信息',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '.sysproxy-card',
      popover: {
        title: '卡片',
        description: '点击导航栏卡片可以跳转到对应页面，拖动导航栏卡片可以自由排列卡片顺序',
        side: 'right',
        align: 'start'
      }
    },
    {
      element: '.main',
      popover: {
        title: '主要区域',
        description: '右侧是应用的主要区域，展示了导航栏所选页面的内容',
        side: 'left',
        align: 'center'
      }
    },
    {
      element: '.profile-card',
      popover: {
        title: '订阅管理',
        description:
          '订阅管理卡片展示当前运行的订阅配置信息，点击进入订阅管理页面可以在这里管理订阅配置',
        side: 'right',
        align: 'start',
        onNextClick: async (): Promise<void> => {
          navigate('/profiles')
          setTimeout(() => {
            firstDriver.moveNext()
          }, 0)
        }
      }
    },
    {
      element: '.profiles-sticky',
      popover: {
        title: '订阅导入',
        description:
          'Sparkle 支持多种订阅导入方式，在此输入订阅链接，点击导入即可导入您的订阅配置，如果您的订阅需要代理才能更新，请勾选“代理”再点击导入，当然这需要已经有一个可以正常使用的订阅才可以',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.substore-import',
      popover: {
        title: 'Sub-Store',
        description:
          'Sparkle 深度集成了 Sub-Store，您可以点击该按钮进入 Sub-Store 或直接导入您通过 Sub-Store 管理的订阅，Sparkle 默认使用内置的 Sub-Store 后端，如果您有自建的 Sub-Store 后端，可以在设置页面中配置，如果您不使用 Sub-Store 也可以在设置页面中关闭',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.new-profile',
      popover: {
        title: '本地订阅',
        description: '点击“+”可以选择本地文件进行导入或者直接新建空白配置进行编辑',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.sysproxy-card',
      popover: {
        title: '系统代理',
        description:
          '导入订阅之后，内核已经开始运行并监听指定端口，此时您已经可以通过指定代理端口来使用代理了，如果您要使大部分应用自动使用该端口的代理，您还需要打开系统代理开关',
        side: 'right',
        align: 'start',
        onNextClick: async (): Promise<void> => {
          navigate('/sysproxy')
          setTimeout(() => {
            firstDriver.moveNext()
          }, 0)
        }
      }
    },
    {
      element: '.sysproxy-settings',
      popover: {
        title: '系统代理设置',
        description:
          '在此您可以进行系统代理相关设置，选择代理模式，如果某些 Windows 应用不遵循系统代理，还可以使用“UWP 工具”解除本地回环限制，对于“手动代理模式”和“PAC 代理模式”的区别，请自行百度',
        side: 'top',
        align: 'start'
      }
    },
    {
      element: '.tun-card',
      popover: {
        title: '虚拟网卡',
        description:
          '虚拟网卡，即同类软件中常见的“Tun 模式”，对于某些不遵循系统代理的应用，您可以打开虚拟网卡以让内核接管所有流量',
        side: 'right',
        align: 'start',
        onNextClick: async (): Promise<void> => {
          navigate('/tun')
          setTimeout(() => {
            firstDriver.moveNext()
          }, 0)
        }
      }
    },
    {
      element: '.tun-settings',
      popover: {
        title: '虚拟网卡设置',
        description:
          '这里可以更改虚拟网卡相关设置，Sparkle 理论上已经完全解决权限问题，如果您的虚拟网卡仍然不可用，可以尝试重设防火墙（Windows）或手动授权内核（MacOS/Linux）后重启内核',
        side: 'bottom',
        align: 'start'
      }
    },
    {
      element: '.override-card',
      popover: {
        title: '覆写',
        description:
          'Sparkle 提供强大的覆写功能，可以对您导入的订阅配置进行个性化修改，如添加规则、自定义代理组等，您可以直接导入别人写好的覆写文件，也可以自己动手编写，<b>编辑好覆写文件一定要记得在需要覆写的订阅上启用</b>，覆写文件的语法请参考 <a href="https://mihomo.party/docs/guide/override" target="_blank">官方文档</a>',
        side: 'right',
        align: 'center'
      }
    },
    {
      element: '.dns-card',
      popover: {
        title: 'DNS',
        description:
          '软件默认接管了内核的 DNS 设置，如果您需要使用订阅配置中的 DNS 设置，可以到应用设置中关闭“接管 DNS 设置”，域名嗅探同理',
        side: 'right',
        align: 'center',
        onNextClick: async (): Promise<void> => {
          navigate('/profiles')
          setTimeout(() => {
            firstDriver.moveNext()
          }, 0)
        }
      }
    },
    {
      element: 'none',
      popover: {
        title: '教程结束',
        description: '现在您已经了解了软件的基本用法，导入您的订阅开始使用吧，祝您使用愉快！',
        side: 'top',
        align: 'center',
        onNextClick: async (): Promise<void> => {
          navigate('/profiles')
          setTimeout(() => {
            firstDriver.destroy()
          }, 0)
        }
      }
    }
  ]
})
