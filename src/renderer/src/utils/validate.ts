import * as isIp from 'is-ip'
import isCidr from 'is-cidr'

export type ValidationResult = { ok: boolean; error?: string }

export const isIPv4 = (ip: string): ValidationResult => {
  if (!ip) return { ok: false, error: 'IP 地址不能为空' }
  try {
    return isIp.isIPv4(ip) ? { ok: true } : { ok: false, error: '无效的 IPv4 地址' }
  } catch (e) {
    return { ok: false, error: '解析 IP 地址时出错' }
  }
}

export const isIPv6 = (ip: string): ValidationResult => {
  if (!ip) return { ok: false, error: 'IP 地址不能为空' }
  try {
    return isIp.isIPv6(ip) ? { ok: true } : { ok: false, error: '无效的 IPv6 地址' }
  } catch (e) {
    return { ok: false, error: '解析 IP 地址时出错' }
  }
}

export const isValidIPv4Cidr = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: true }
  const v = s.trim()
  try {
    const r = isCidr(v)
    if (r === 4) return { ok: true }
    if (r === 6) return { ok: false, error: '这是 IPv6 CIDR，而不是 IPv4 CIDR' }
    return { ok: false, error: '不是有效的 CIDR 格式（示例：198.18.0.1/16）' }
  } catch (e) {
    return { ok: false, error: '解析 CIDR 时出错' }
  }
}

export const isValidIPv6Cidr = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: true }
  const v = s.trim()
  try {
    const r = isCidr(v)
    if (r === 6) return { ok: true }
    if (r === 4) return { ok: false, error: '这是 IPv4 CIDR，而不是 IPv6 CIDR' }
    return { ok: false, error: '不是有效的 CIDR 格式（示例：fc00::/18）' }
  } catch (e) {
    return { ok: false, error: '解析 CIDR 时出错' }
  }
}

export const isValidPort = (s: string): ValidationResult => {
  if (!/^\d+$/.test(s)) return { ok: false, error: '端口应为数字' }
  const p = Number(s)
  return p >= 1 && p <= 65535 ? { ok: true } : { ok: false, error: '端口应在 1 到 65535 之间' }
}

export const isValidListenAddress = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: true }
  const v = s.trim()
  if (v.startsWith(':')) {
    return isValidPort(v.slice(1))
  }
  const idx = v.lastIndexOf(':')
  if (idx === -1) return { ok: false, error: '应包含端口号' }
  const host = v.slice(0, idx)
  const port = v.slice(idx + 1)
  if (!isValidPort(port)) return { ok: false, error: '端口号不合法' }
  if (host.startsWith('[') && host.endsWith(']')) {
    const inner = host.slice(1, -1)
    return isIPv6(inner)
  }
  if (/^[0-9a-zA-Z-.]+$/.test(host)) {
    if (/^[0-9.]+$/.test(host)) {
      return isIPv4(host)
    }
    return /^[a-zA-Z0-9-.]+$/.test(host) ? { ok: true } : { ok: false, error: '主机名包含非法字符' }
  }
  return { ok: false, error: '主机名包含非法字符' }
}

export const isValidDomainWildcard = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: false, error: '不能为空' }
  const v = s.trim()
  if (v.startsWith('rule-set:') || v.startsWith('geosite:')) {
    const rest = v.split(':')[1]
    if (!!rest && rest.length > 0) return { ok: true }
    return { ok: false, error: '规则集或 geosite 名称不能为空' }
  }
  if (v === '*') return { ok: true }

  if (v.startsWith('+.')) {
    const domain = v.slice(2)
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(domain)) return { ok: true }
    return { ok: false, error: '+. 开头后应为合法的域名，例如 +.lan' }
  }

  if (v.startsWith('.')) {
    const domain = v.slice(1)
    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(domain)) return { ok: true }
    return { ok: false, error: '. 开头后应为合法的域名' }
  }

  if (v.includes('*')) {
    const labels = v.split('.')
    if (labels.every((lab) => lab === '*' || /^[a-zA-Z0-9-]+$/.test(lab))) return { ok: true }
    return { ok: false, error: '通配符位置或标签不合法' }
  }

  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(v)) return { ok: true }
  return { ok: false, error: '不是合法的域名或通配符表达式' }
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

export const isValidDnsServer = (s: string | undefined): ValidationResult => {
  if (!s || s.trim() === '') return { ok: false, error: '不能为空' }
  const v = s.trim()
  const hashIndex = v.indexOf('#')
  const serverPart = hashIndex === -1 ? v : v.slice(0, hashIndex)
  const paramsPart = hashIndex === -1 ? '' : v.slice(hashIndex + 1)

  if (!serverPart) return { ok: false, error: '服务器地址不能为空' }
  if (paramsPart) {
    const boolParams = [
      'ecs-override',
      'h3',
      'prefer-h3',
      'skip-cert-verify',
      'disable-ipv4',
      'disable-ipv6'
    ]

    const params = paramsPart
      .split('&')
      .map((p) => p.trim())
      .filter(Boolean)
    for (const param of params) {
      if (param.includes('=')) {
        const [key, value] = param.split('=')
        if (!key || !value) {
          return { ok: false, error: '参数格式不合法，key=value 格式中 key 和 value 都不能为空' }
        }
        if (!/^[a-zA-Z0-9-_]+$/.test(key)) {
          return { ok: false, error: `参数名 "${key}" 不合法` }
        }
        if (boolParams.includes(key) && value !== 'true' && value !== 'false') {
          return { ok: false, error: `参数 "${key}" 的值必须是 true 或 false` }
        }
        if (key === 'ecs' && !/^[a-zA-Z0-9-_./:]+$/.test(value)) {
          return { ok: false, error: `参数值 "${value}" 不合法` }
        }
      } else {
        if (boolParams.includes(param) || param === 'ecs') {
          return { ok: false, error: `参数 "${param}" 必须指定值` }
        }
        if (!/^[a-zA-Z0-9-_]+$/.test(param)) {
          return { ok: false, error: `参数 "${param}" 不合法` }
        }
      }
    }
  }

  const lower = serverPart.toLowerCase()

  if (lower === 'system' || lower === 'system://') return { ok: true }

  if (lower.startsWith('dhcp://')) {
    const rest = serverPart.slice('dhcp://'.length)
    if (!rest) return { ok: false, error: 'dhcp:// 后应跟接口名或 system' }
    if (rest.toLowerCase() === 'system') return { ok: true }
    if (/^[a-zA-Z0-9_.-]+$/.test(rest)) return { ok: true }
    return { ok: false, error: 'dhcp 接口名只允许字母数字、下划线、点或连字符' }
  }

  if (lower.startsWith('rcode://')) {
    const code = lower.slice('rcode://'.length)
    const allowed = new Set([
      'success',
      'format_error',
      'server_failure',
      'name_error',
      'not_implemented',
      'refused'
    ])
    return allowed.has(code) ? { ok: true } : { ok: false, error: '无效的 rcode 值' }
  }

  if (/^https?:\/\//i.test(serverPart)) {
    try {
      const u = new URL(serverPart)
      if (!u.hostname) return { ok: false, error: '无效的 URL 主机名' }
      return { ok: true }
    } catch (e) {
      return { ok: false, error: '无效的 URL 格式' }
    }
  }

  const schemeMatch = serverPart.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/)
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase()
    const rest = schemeMatch[2]
    if (!['udp', 'tcp', 'tls', 'quic'].includes(scheme)) {
      return { ok: false, error: '不支持的协议：' + scheme }
    }
    const hostPort = rest.split('/')[0]
    const hpIdx = hostPort.lastIndexOf(':')
    let host = hostPort
    let portStr: string | undefined
    if (
      hpIdx !== -1 &&
      !(hostPort.startsWith('[') && hostPort.includes(']') && hpIdx > hostPort.indexOf(']'))
    ) {
      host = hostPort.slice(0, hpIdx)
      portStr = hostPort.slice(hpIdx + 1)
    }
    if (!host) return { ok: false, error: `${scheme} 地址缺少主机` }
    if (/^[0-9.]+$/.test(host)) {
      const r = isIPv4(host)
      if (!r.ok) return { ok: false, error: '无效的 IPv4 地址' }
    } else if (host.startsWith('[') && host.endsWith(']')) {
      const inner = host.slice(1, -1)
      const r = isIPv6(inner)
      if (!r.ok) return { ok: false, error: '无效的 IPv6 地址' }
    } else {
      if (!/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(host)) {
        return { ok: false, error: '无效的主机名' }
      }
    }
    if (portStr) {
      if (!/^[0-9]+$/.test(portStr)) return { ok: false, error: '端口格式不正确' }
      const p = Number(portStr)
      if (p < 1 || p > 65535) return { ok: false, error: '端口超出范围' }
    }
    return { ok: true }
  }

  const idx = serverPart.lastIndexOf(':')
  if (idx !== -1 && serverPart.includes(']') === false) {
    const host = serverPart.slice(0, idx)
    const port = serverPart.slice(idx + 1)
    if (!/^[0-9]+$/.test(port)) return { ok: false, error: '端口格式不正确' }
    if (!host) return { ok: false, error: '主机不能为空' }
    if (/^[0-9.]+$/.test(host)) {
      const r = isIPv4(host)
      return r.ok ? { ok: true } : { ok: false, error: '无效的 IPv4 地址' }
    }
    if (host.startsWith('[') && host.endsWith(']')) {
      const inner = host.slice(1, -1)
      const r = isIPv6(inner)
      return r.ok ? { ok: true } : { ok: false, error: '无效的 IPv6 地址' }
    }
    return /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(host)
      ? { ok: true }
      : { ok: false, error: '无效的主机名' }
  }

  if (serverPart.startsWith('[') && serverPart.endsWith(']')) {
    const inner = serverPart.slice(1, -1)
    const r = isIPv6(inner)
    return r.ok ? { ok: true } : { ok: false, error: '无效的 IPv6 地址' }
  }
  if (/^[0-9.]+$/.test(serverPart)) {
    const r = isIPv4(serverPart)
    return r.ok ? { ok: true } : { ok: false, error: '无效的 IPv4 地址' }
  }
  if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$/.test(serverPart)) return { ok: true }
  return { ok: false, error: '无效的服务器地址' }
}
