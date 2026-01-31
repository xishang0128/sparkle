// ${api}/configs
interface ControllerConfigs {
  port: number
  'socks-port': number
  'redir-port': number
  'tproxy-port': number
  'mixed-port': number
  tun: ControllerTunDetail
  authentication: string[] | null
  'skip-auth-prefixes': string[]
  'lan-allowed-ips': string[]
  'lan-disallowed-ips': string[]
  'allow-lan': boolean
  'bind-address': string
  'inbound-tfo': boolean
  'inbound-mptcp': boolean
  mode: OutboundMode
  'unified-delay': boolean
  'log-level': LogLevel
  ipv6: boolean
  'interface-name': string
  'routing-mark': number
  'geox-url': {
    mmdb: string
    asn: string
    'geo-ip': string
    'geo-site': string
  }
  'geo-auto-update': boolean
  'geo-update-interval': number
  'geodata-mode': boolean
  'geodata-loader': string
  'geosite-matcher': string
  'tcp-concurrent': boolean
  'find-process-mode': string
  sniffing: true
  'global-client-fingerprint': string
  'global-ua': string
  'etag-support': boolean
  'keep-alive-idle': number
  'keep-alive-interval': number
  'disable-keep-alive': boolean
}

interface ControllerTunDetail {
  enable: boolean
  device: string
  stack: TunStack
  'dns-hijack': string[]
  'auto-route': boolean
  'auto-redirect'?: boolean
  'auto-detect-interface': boolean
  mtu: number
  'inet4-address': string[]
  'inet6-address': string[]
  'file-descriptor': number
}

// ${api}/connections
interface ControllerConnections {
  downloadTotal: number
  uploadTotal: number
  connections?: ControllerConnectionDetail[]
  memory: number
}

// ${api}/connections/:id
interface ControllerConnectionDetail {
  id: string
  metadata: {
    network: 'tcp' | 'udp'
    type: string
    sourceIP: string
    destinationIP: string
    sourceGeoIP: string[]
    destinationGeoIP: string[]
    sourceIPASN: string
    destinationIPASN: string
    sourcePort: string
    destinationPort: string
    inboundIP: string
    inboundPort: string
    inboundName: string
    inboundUser: string
    host: string
    dnsMode: string
    uid: number
    process: string
    processPath: string
    specialProxy: string
    specialRules: string
    remoteDestination: string
    dscp: number
    sniffHost: string
  }
  upload: number
  download: number
  start: string
  chains: string[]
  rule: string
  rulePayload: string

  // 自定义内容
  isActive: boolean
  uploadSpeed?: number
  downloadSpeed?: number
}

// ${api}/logs
interface ControllerLog {
  type: LogLevel
  payload: string
  time?: string
}

// ${api}/memory
interface ControllerMemory {
  inuse: number
  oslimit: number
}

// ${api}/proxies
interface ControllerProxies {
  proxies: Record<string, ControllerProxiesDetail | ControllerGroupDetail>
}

interface ControllerProxiesHistory {
  time: string
  delay: number
}

interface ControllerProxiesDetail {
  alive: boolean
  extra: Record<string, { alive: boolean; history: ControllerProxiesHistory[] }>
  history: ControllerProxiesHistory[]
  id: string
  name: string
  tfo: boolean
  type: MihomoProxyType
  udp: boolean
  xudp: boolean
  'dialer-proxy': string
  interface: string
  mptcp: boolean
  'routing-mark': number
  smux: boolean
  uot: boolean
}

interface ControllerGroupDetail {
  alive: boolean
  all: string[]
  extra: Record<string, { alive: boolean; history: ControllerProxiesHistory[] }>
  hidden: boolean
  history: ControllerProxiesHistory[]
  icon: string
  interface: string
  mptcp: boolean
  name: string
  now: string
  smux: boolean
  testUrl?: string
  tfo: boolean
  type: MihomoProxyType
  udp: boolean
  uot: boolean
  xudp: boolean
  expectedStatus?: string
  fixed?: string
}

// 自定义 group 内容
interface ControllerMixedGroup extends ControllerGroupDetail {
  all: (ControllerProxyDetail | ControllerGroupDetail)[]
}

// ${api}/proxies/:name/delay
interface ControllerProxiesDelay {
  delay?: number
  message?: string
}

// ${api}/group/:name/delay
interface ControllerGroupDelay {
  [key: string]: number
}

interface ControllerTraffic {
  up: number
  down: number
}

// ${api}/rules
interface ControllerRules {
  rules: ControllerRulesDetail[]
}

interface ControllerRulesDetail {
  index: number
  type: string
  payload: string
  proxy: string
  size: number
  extra: {
    disabled: boolean
    hitCount: number
    hitAt: string
    missCount: number
    missAt: string
  }
}

// ${api}/version
interface ControllerVersion {
  version: string
  meta: boolean
}

// ${api}/providers/proxies
interface ControllerProxyProviders {
  providers: Record<string, ControllerProxyProviderDetail>
}

interface ControllerProxyProviderDetail {
  name: string
  type: string
  proxies?: ControllerProxiesDetail[]
  subscriptionInfo?: ControllerSubscriptionUserInfoUpper
  expectedStatus: string
  testUrl?: string
  updatedAt?: string
  vehicleType: string
}

interface ControllerSubscriptionUserInfoUpper {
  Upload: number
  Download: number
  Total: number
  Expire: number
}

// ${api}/providers/rules
interface ControllerRuleProviders {
  providers: Record<string, ControllerRuleProviderDetail>
}

interface ControllerRuleProviderDetail {
  behavior: string
  format: string
  name: string
  ruleCount: number
  type: string
  updatedAt: string
  vehicleType: string
}
