import os from 'os'

export const defaultConfig: AppConfig = {
  core: 'mihomo',
  updateChannel: 'stable',
  silentStart: false,
  appTheme: 'system',
  useWindowFrame: false,
  proxyInTray: true,
  maxLogDays: 7,
  proxyCols: 'auto',
  connectionDirection: 'asc',
  connectionOrderBy: 'time',
  useSubStore: true,
  proxyDisplayMode: 'simple',
  proxyDisplayOrder: 'default',
  autoCheckUpdate: false,
  autoCloseConnection: true,
  controlDns: true,
  controlSniff: true,
  hosts: [],
  siderOrder: [
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
  siderWidth: 250,
  sysProxy: { enable: false, mode: 'manual' },
  disableLoopbackDetector: false,
  disableEmbedCA: false,
  disableSystemCA: false,
  disableNftables: false,
  safePaths: [],
  disableGPU: process.platform === 'win32' && parseInt(os.release().split('.')[2], 10) <= 20000,
  proxyDisplayLayout: 'double',
  groupDisplayLayout: 'double'
}

export const defaultControledMihomoConfig: Partial<MihomoConfig> = {
  'external-controller': '',
  'external-ui': '',
  'external-ui-url': 'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
  'external-controller-cors': {
    'allow-origins': ['https://metacubex.github.io', 'https://board.zash.run.place'],
    'allow-private-network': false
  },
  secret: '',
  ipv6: true,
  mode: 'rule',
  'mixed-port': 7890,
  'socks-port': 0,
  port: 0,
  'redir-port': 0,
  'tproxy-port': 0,
  'allow-lan': false,
  'unified-delay': false,
  'tcp-concurrent': false,
  'log-level': 'info',
  'find-process-mode': 'always',
  'interface-name': '',
  'bind-address': '*',
  'keep-alive-idle': 0,
  'keep-alive-interval': 0,
  'disable-keep-alive': false,
  'global-client-fingerprint': '',
  'lan-allowed-ips': ['0.0.0.0/0', '::/0'],
  'lan-disallowed-ips': [],
  authentication: [],
  'skip-auth-prefixes': ['127.0.0.1/32'],
  tun: {
    enable: false,
    device: process.platform === 'darwin' ? undefined : 'mihomo',
    stack: 'mixed',
    'auto-route': true,
    'auto-redirect': false,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53'],
    'route-exclude-address': [],
    mtu: 1500
  },
  dns: {
    enable: true,
    ipv6: true,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter': ['*', '+.lan', '+.local', 'time.*.com', 'ntp.*.com', '+.market.xiaomi.com'],
    'use-hosts': false,
    'use-system-hosts': false,
    'default-nameserver': ['tls://223.5.5.5'],
    nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
    'proxy-server-nameserver': [],
    'direct-nameserver': []
  },
  sniffer: {
    enable: true,
    'parse-pure-ip': true,
    'force-dns-mapping': true,
    'override-destination': false,
    sniff: {
      HTTP: {
        ports: [80, 443],
        'override-destination': false
      },
      TLS: {
        ports: [443]
      }
    },
    'skip-domain': ['+.push.apple.com'],
    'skip-dst-address': [
      '91.105.192.0/23',
      '91.108.4.0/22',
      '91.108.8.0/21',
      '91.108.16.0/21',
      '91.108.56.0/22',
      '95.161.64.0/20',
      '149.154.160.0/20',
      '185.76.151.0/24',
      '2001:67c:4e8::/48',
      '2001:b28:f23c::/47',
      '2001:b28:f23f::/48',
      '2a0a:f280:203::/48'
    ]
  },
  profile: {
    'store-selected': true,
    'store-fake-ip': true
  },
  'geo-auto-update': false,
  'geo-update-interval': 24,
  'geodata-mode': false,
  'geox-url': {
    geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat',
    geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
    mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb',
    asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb'
  }
}

export const defaultProfileConfig: ProfileConfig = {
  items: []
}

export const defaultOverrideConfig: OverrideConfig = {
  items: []
}

export const defaultProfile: Partial<MihomoConfig> = {
  proxies: [],
  'proxy-groups': [],
  rules: []
}
