import type { NavigateFunction } from 'react-router-dom'

type Driver = {
  drive: () => void
  destroy: () => void
  moveNext: () => void
}

let driverInstance: Driver | null = null
let cssLoaded = false

async function loadDriverModule(): Promise<typeof import('driver.js')> {
  if (!cssLoaded) {
    await import('driver.js/dist/driver.css')
    cssLoaded = true
  }
  return import('driver.js')
}

export async function createDriver(navigate: NavigateFunction): Promise<Driver> {
  if (driverInstance) return driverInstance

  const { driver } = await loadDriverModule()

  driverInstance = driver({
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
              driverInstance?.moveNext()
            }, 0)
          }
        }
      },
      {
        element: '.profiles-sticky',
        popover: {
          title: '订阅导入',
          description:
            'Sparkle 支持多种订阅导入方式，在此输入订阅链接，点击导入即可导入您的订阅配置，如果您的订阅需要代理才能更新，请勾选"代理"再点击导入，当然这需要已经有一个可以正常使用的订阅才可以',
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
          description: '点击"+"可以选择本地文件进行导入或者直接新建空白配置进行编辑',
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
              driverInstance?.moveNext()
            }, 0)
          }
        }
      },
      {
        element: '.sysproxy-settings',
        popover: {
          title: '系统代理设置',
          description:
            '在此您可以进行系统代理相关设置，选择代理模式，如果某些 Windows 应用不遵循系统代理，还可以使用"UWP 工具"解除本地回环限制，对于"手动代理模式"和"PAC 代理模式"的区别，请自行百度',
          side: 'top',
          align: 'start'
        }
      },
      {
        element: '.tun-card',
        popover: {
          title: '虚拟网卡',
          description:
            '虚拟网卡，即同类软件中常见的"Tun 模式"，对于某些不遵循系统代理的应用，您可以打开虚拟网卡以让内核接管所有流量',
          side: 'right',
          align: 'start',
          onNextClick: async (): Promise<void> => {
            navigate('/tun')
            setTimeout(() => {
              driverInstance?.moveNext()
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
            '软件默认接管了内核的 DNS 设置，如果您需要使用订阅配置中的 DNS 设置，可以到应用设置中关闭"接管 DNS 设置"，域名嗅探同理',
          side: 'right',
          align: 'center',
          onNextClick: async (): Promise<void> => {
            navigate('/profiles')
            setTimeout(() => {
              driverInstance?.moveNext()
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
              driverInstance?.destroy()
            }, 0)
          }
        }
      }
    ]
  })

  return driverInstance
}

export async function startTour(navigate: NavigateFunction): Promise<void> {
  const d = await createDriver(navigate)
  d.drive()
}

export function getDriver(): Driver | null {
  return driverInstance
}
