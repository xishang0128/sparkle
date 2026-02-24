interface MihomoConfig {
  'external-controller-pipe': string
  'external-controller-unix': string
  'external-controller': string
  'external-ui': string
  'external-ui-url': string
  'external-controller-cors'?: {
    'allow-origins'?: string[]
    'allow-private-network'?: boolean
  }
  secret?: string
  ipv6: boolean
  mode: OutboundMode
  'mixed-port': number
  'allow-lan': boolean
  'unified-delay': boolean
  'tcp-concurrent': boolean
  'interface-name': string
  'global-client-fingerprint': Fingerprints
  'log-level': LogLevel
  'find-process-mode': FindProcessMode
  'socks-port'?: number
  'redir-port'?: number
  'tproxy-port'?: number
  'keep-alive-idle': number
  'keep-alive-interval': number
  'disable-keep-alive': boolean
  'skip-auth-prefixes'?: string[]
  'bind-address'?: string
  'lan-allowed-ips'?: string[]
  'lan-disallowed-ips'?: string[]
  authentication: string[]
  port?: number
  proxies?: []
  'proxy-groups'?: []
  rules?: []
  hosts?: { [key: string]: string | string[] }
  'geodata-mode'?: boolean
  'geo-auto-update'?: boolean
  'geo-update-interval'?: number
  'geox-url'?: {
    geoip?: string
    geosite?: string
    mmdb?: string
    asn?: string
  }
  tun: MihomoTunConfig
  dns: MihomoDNSConfig
  sniffer: MihomoSnifferConfig
  profile: MihomoProfileConfig
  'rule-providers'?: Record<string, unknown>
  'proxy-providers'?: Record<string, unknown>
}

interface MihomoTunConfig {
  enable?: boolean
  stack?: TunStack
  'auto-route'?: boolean
  'auto-redirect'?: boolean
  'auto-detect-interface'?: boolean
  'dns-hijack'?: string[]
  device?: string
  mtu?: number
  'strict-route'?: boolean
  'disable-icmp-forwarding'?: boolean
  gso?: boolean
  'gso-max-size'?: number
  'udp-timeout'?: number
  'iproute2-table-index'?: number
  'iproute2-rule-index'?: number
  'endpoint-independent-nat'?: boolean
  'route-address-set'?: string[]
  'route-exclude-address-set'?: string[]
  'route-address'?: string[]
  'route-exclude-address'?: string[]
  'include-interface'?: string[]
  'exclude-interface'?: string[]
  'include-uid'?: number[]
  'include-uid-range'?: string[]
  'exclude-uid'?: number[]
  'exclude-uid-range'?: string[]
  'include-android-user'?: string[]
  'include-package'?: string[]
  'exclude-package'?: string[]
}

interface MihomoDNSConfig {
  enable?: boolean
  listen?: string
  ipv6?: boolean
  'ipv6-timeout'?: number
  'prefer-h3'?: boolean
  'enhanced-mode'?: DnsMode
  'fake-ip-range'?: string
  'fake-ip-range6'?: string
  'fake-ip-filter'?: string[]
  'fake-ip-filter-mode'?: FilterMode
  'use-hosts'?: boolean
  'use-system-hosts'?: boolean
  'respect-rules'?: boolean
  'default-nameserver'?: string[]
  nameserver?: string[]
  fallback?: string[]
  'fallback-filter'?: { [key: string]: boolean | string | string[] }
  'proxy-server-nameserver'?: string[]
  'direct-nameserver'?: string[]
  'direct-nameserver-follow-policy'?: boolean
  'nameserver-policy'?: { [key: string]: string | string[] }
  'proxy-server-nameserver-policy'?: { [key: string]: string | string[] }
  'cache-algorithm'?: string
}

interface MihomoSnifferConfig {
  enable?: boolean
  'parse-pure-ip'?: boolean
  'override-destination'?: boolean
  'force-dns-mapping'?: boolean
  'force-domain'?: string[]
  'skip-domain'?: string[]
  'skip-dst-address'?: string[]
  'skip-src-address'?: string[]
  sniff?: {
    HTTP?: {
      ports: (number | string)[]
      'override-destination'?: boolean
    }
    TLS?: {
      ports: (number | string)[]
    }
    QUIC?: {
      ports: (number | string)[]
    }
  }
}

interface MihomoProfileConfig {
  'store-selected'?: boolean
  'store-fake-ip'?: boolean
}

interface ProxyProviderConfig {
  path?: string
  url?: string
}
