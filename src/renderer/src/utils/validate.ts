import * as isIp from 'is-ip'
import isCidr from 'is-cidr'

export const isIPv4 = (ip: string): boolean => {
  if (!ip) return false
  try {
    return isIp.isIPv4(ip)
  } catch (e) {
    return false
  }
}

export const isIPv6 = (ip: string): boolean => {
  if (!ip) return false
  try {
    return isIp.isIPv6(ip)
  } catch (e) {
    return false
  }
}

export const isValidIPv4Cidr = (s: string | undefined): boolean => {
  if (!s || s.trim() === '') return true
  try {
    return isCidr(s) === 4
  } catch (e) {
    return false
  }
}

export const isValidIPv6Cidr = (s: string | undefined): boolean => {
  if (!s || s.trim() === '') return true
  try {
    return isCidr(s) === 6
  } catch (e) {
    return false
  }
}

export const isValidPort = (s: string): boolean => {
  if (!/^\d+$/.test(s)) return false
  const p = Number(s)
  return p >= 1 && p <= 65535
}

export const isValidListenAddress = (s: string | undefined): boolean => {
  if (!s || s.trim() === '') return true
  const v = s.trim()
  if (v.startsWith(':')) {
    return isValidPort(v.slice(1))
  }
  const idx = v.lastIndexOf(':')
  if (idx === -1) return false
  const host = v.slice(0, idx)
  const port = v.slice(idx + 1)
  if (!isValidPort(port)) return false
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1)
    return isIPv6(inner)
  }
  if (/^[0-9a-zA-Z-.]+$/.test(host)) {
    if (/^[0-9.]+$/.test(host)) {
      return isIPv4(host)
    }
    return /^[a-zA-Z0-9-.]+$/.test(host)
  }
  return false
}

export const isValidDomainWildcard = (s: string | undefined): boolean => {
  if (!s || s.trim() === '') return false
  const v = s.trim()
  if (v.startsWith('rule-set:') || v.startsWith('geosite:')) {
    const rest = v.split(':')[1]
    return !!rest && rest.length > 0
  }
  if (v === '*') return true

  if (v.startsWith('+.')) {
    const domain = v.slice(2)
    return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(domain)
  }

  if (v.startsWith('.')) {
    const domain = v.slice(1)
    return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(domain)
  }

  if (v.includes('*')) {
    const labels = v.split('.')
    return labels.every((lab) => lab === '*' || /^[a-zA-Z0-9-]+$/.test(lab))
  }

  return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(v)
}

export const isValidPortRange = (s: string | undefined): boolean => {
  if (!s || s.trim() === '') return false
  const parts = s
    .split(/[,/]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length === 0) return false
  for (const p of parts) {
    if (p.includes('-')) {
      const [a, b] = p.split('-')
      if (!/^\d+$/.test(a) || !/^\d+$/.test(b)) return false
      const na = Number(a)
      const nb = Number(b)
      if (na < 1 || nb > 65535 || na > nb) return false
    } else {
      if (!/^\d+$/.test(p)) return false
      const np = Number(p)
      if (np < 1 || np > 65535) return false
    }
  }
  return true
}
