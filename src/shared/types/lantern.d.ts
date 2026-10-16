interface LanternOptions {
  gateway_mode: boolean
  interface: string
  gateway_ipv4?: string
  gateway_ipv6?: string
  discovery: { enabled: boolean; mdns?: boolean; ssdp?: boolean }
  ra: { enabled: boolean; targets?: string[]; rdnss?: string[]; auto_prefixes?: boolean }
  dhcp?: {
    enabled: boolean
    exclusive_pool: boolean
    pool_start?: string
    pool_end?: string
    dns?: string[]
    allowed_macs?: string[]
    gateway_macs?: string[]
    reservations?: { mac: string; ip: string }[]
  }
}

interface LanternDevice {
  mac: string
  interface: string
  addresses: { ip: string; source: string }[]
  evidence: { field: string; value: string; confidence: string; source: string }[]
}

interface LanternDHCPServer {
  address: string
  mac: string
  relay_ip?: string
}

interface LanternProbe {
  interface: string
  discoveries_sent: number
  servers: LanternDHCPServer[]
  truncated: boolean
}

interface LanternSnapshot {
  supported: boolean
  gateway_mode: boolean
  options?: LanternOptions
  devices: LanternDevice[]
  status: {
    problems?: string[]
    ra: { suspended_reason?: string; last_error?: string }
    dhcp: {
      running: boolean
      paused_reason?: string
      last_error?: string
      leases:
        | {
            mac: string
            ip: string
            state: string
            hostname?: string
            vendor_class?: string
            expires_at: string
          }[]
        | null
    }
  }
}

interface LanternNetwork {
  dns?: string[]
  default_routes: { interface: string; gateway: string; metric: number }[]
  interfaces: {
    name: string
    physical: boolean
    lan_capable: boolean
    addresses: string[]
  }[]
}
