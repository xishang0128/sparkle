export function gatewayDeviceName(device: LanternDevice): string {
  return (
    (
      device.evidence.find((e) => e.field === 'hostname' && e.source.startsWith('dhcp')) ||
      device.evidence.find((e) => ['hostname', 'name'].includes(e.field))
    )?.value || device.mac
  )
}

export function gatewayDevices(data?: LanternSnapshot): LanternDevice[] {
  if (!data?.gateway_mode) return []
  const clients = new Map<string, LanternDevice>()
  const observedDevices = new Map(
    data.devices
      .filter((device) => device.interface === data.options?.interface)
      .map((device) => [device.mac, device])
  )
  for (const lease of data.status.dhcp.leases || []) {
    if (lease.state !== 'bound' || !(new Date(lease.expires_at).getTime() > Date.now())) continue
    const observed = observedDevices.get(lease.mac)
    let client = clients.get(lease.mac)
    if (!client) {
      client = {
        mac: lease.mac,
        interface: data?.options?.interface || '',
        addresses: [],
        evidence: [...(observed?.evidence || [])]
      }
      for (const [field, value] of [
        ['hostname', lease.hostname],
        ['vendor_class', lease.vendor_class]
      ] as const) {
        if (value) {
          client.evidence = client.evidence.filter((e) => e.field !== field)
          client.evidence.unshift({ field, value, source: 'dhcp-server', confidence: 'observed' })
        }
      }
      clients.set(lease.mac, client)
    }
    client.addresses.push({
      ip: lease.ip,
      source: 'dhcp-server'
    })
  }
  return Array.from(clients.values())
}

export function deviceAddressKey(address: string): string {
  const ip = address.split('%')[0].toLowerCase()
  if (!ip.includes(':')) return ip
  try {
    const normalized = new URL(`http://[${ip}]`).hostname.slice(1, -1)
    const mapped = /^::ffff:([\da-f]+):([\da-f]+)$/.exec(normalized)
    if (mapped) {
      const high = parseInt(mapped[1], 16)
      const low = parseInt(mapped[2], 16)
      return [high >> 8, high & 255, low >> 8, low & 255].join('.')
    }
    return normalized
  } catch {
    return ip
  }
}

export function gatewayDeviceNames(data?: LanternSnapshot): Map<string, string> {
  const owners = new Map<string, LanternDevice | null>()
  const add = (ip: string, device: LanternDevice): void => {
    const key = deviceAddressKey(ip)
    const owner = owners.get(key)
    owners.set(key, owner === undefined || owner?.mac === device.mac ? device : null)
  }
  for (const device of gatewayDevices(data)) {
    for (const address of device.addresses) add(address.ip, device)
    const observed = data?.devices.find(
      (d) => d.mac === device.mac && d.interface === device.interface
    )
    for (const address of observed?.addresses || []) {
      if (address.ip.includes(':') && address.source.startsWith('ndp')) add(address.ip, device)
    }
  }
  return new Map(
    Array.from(owners).flatMap(([ip, device]) => (device ? [[ip, gatewayDeviceName(device)]] : []))
  )
}
