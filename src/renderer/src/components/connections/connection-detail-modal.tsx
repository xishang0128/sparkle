import { Button, Description, Dropdown, Label, Modal, Separator, Surface } from '@heroui-v3/react'
import type { ReactNode } from 'react'
import { calcTraffic } from '@renderer/utils/calc'
import dayjs from 'dayjs'
import { BiCopy } from 'react-icons/bi'

interface Props {
  connection: ControllerConnectionDetail
  onClose: () => void
}

interface CopyProps {
  title: string
  value: string | string[]
  displayName?: string
  prefix?: string[]
}

interface StaticRow {
  kind: 'static'
  title: string
  content: ReactNode
}

interface CopyRow extends CopyProps {
  kind: 'copy'
}

function buildCopyMenuItems(value: string | string[], displayName?: string, prefix: string[] = []) {
  const getSubDomains = (domain: string): string[] =>
    domain.split('.').length <= 2
      ? [domain]
      : domain
          .split('.')
          .map((_, i, parts) => parts.slice(i).join('.'))
          .slice(0, -1)

  const isIPv6 = (ip: string): boolean => ip.includes(':')

  return [
    { key: 'raw', text: displayName || (Array.isArray(value) ? value.join(', ') : value) },
    ...(Array.isArray(value)
      ? value
          .map((v, i) => {
            const p = prefix[i]
            if (!p || !v) return null

            if (p === 'DOMAIN-SUFFIX') {
              return getSubDomains(v).map((subV) => ({
                key: `${p},${subV}`,
                text: `${p},${subV}`
              }))
            }

            if (p === 'IP-ASN' || p === 'SRC-IP-ASN') {
              return {
                key: `${p},${v.split(' ')[0]}`,
                text: `${p},${v.split(' ')[0]}`
              }
            }

            const suffix =
              p === 'IP-CIDR' || p === 'SRC-IP-CIDR' ? (isIPv6(v) ? '/128' : '/32') : ''
            return {
              key: `${p},${v}${suffix}`,
              text: `${p},${v}${suffix}`
            }
          })
          .filter(Boolean)
          .flat()
      : prefix
          .map((p) => {
            const v = value as string
            if (p === 'DOMAIN-SUFFIX') {
              return getSubDomains(v).map((subV) => ({
                key: `${p},${subV}`,
                text: `${p},${subV}`
              }))
            }

            if (p === 'IP-ASN' || p === 'SRC-IP-ASN') {
              return {
                key: `${p},${v.split(' ')[0]}`,
                text: `${p},${v.split(' ')[0]}`
              }
            }

            const suffix =
              p === 'IP-CIDR' || p === 'SRC-IP-CIDR' ? (isIPv6(v) ? '/128' : '/32') : ''
            return {
              key: `${p},${v}${suffix}`,
              text: `${p},${v}${suffix}`
            }
          })
          .flat())
  ]
}

const ConnectionDetailModal = ({ connection, onClose }: Props) => {
  const renderRow = (
    title: string,
    content: ReactNode,
    actions?: ReactNode,
    hasSeparator: boolean = true
  ) => (
    <Surface key={title} variant="transparent" className="flex flex-col">
      <Surface
        variant="transparent"
        className="grid grid-cols-[120px_auto_minmax(0,1fr)] items-stretch gap-x-2"
      >
        <Surface variant="transparent" className="flex min-h-10 items-center py-2">
          <Label>{title}</Label>
        </Surface>
        <Surface variant="transparent" className="relative min-h-10 py-2">
          {actions ? (
            <Surface
              variant="transparent"
              className="absolute top-1/2 -left-7 z-10 flex -translate-y-1/2 items-center"
            >
              {actions}
            </Surface>
          ) : null}
          <Description className="min-w-0 text-sm leading-6 text-foreground-700 select-text break-all">
            {content}
          </Description>
        </Surface>
      </Surface>
      {hasSeparator ? <Separator variant="tertiary" className="bg-default-100/70" /> : null}
    </Surface>
  )

  const renderCopyableRow = (
    { title, value, displayName, prefix = [] }: CopyProps,
    hasSeparator: boolean
  ) => {
    const menuItems = buildCopyMenuItems(value, displayName, prefix)
    const action = (
      <Dropdown>
        <Dropdown.Trigger>
          <Button
            aria-label="复制规则"
            isIconOnly
            size="sm"
            variant="tertiary"
            className="app-nodrag h-6 min-h-6 w-6 min-w-6"
          >
            <BiCopy className="text-base" />
          </Button>
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end" className="min-w-55">
          <Dropdown.Menu
            onAction={(key) =>
              navigator.clipboard.writeText(
                key === 'raw' ? (Array.isArray(value) ? value.join(', ') : value) : (key as string)
              )
            }
          >
            {menuItems
              .filter((item) => item !== null)
              .map(({ key, text }) => (
                <Dropdown.Item id={key} key={key} textValue={text}>
                  <Label>{text}</Label>
                </Dropdown.Item>
              ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    )

    return renderRow(
      title,
      displayName || (Array.isArray(value) ? value.join(', ') : value),
      action,
      hasSeparator
    )
  }

  const rows: Array<StaticRow | CopyRow> = [
    { kind: 'static', title: '连接建立时间', content: dayjs(connection.start).fromNow() },
    {
      kind: 'static',
      title: '规则',
      content: (
        <>
          {connection.rule ? connection.rule : '未命中任何规则'}
          {connection.rulePayload ? `(${connection.rulePayload})` : ''}
        </>
      )
    },
    { kind: 'static', title: '代理链', content: [...connection.chains].reverse().join('>>') },
    { kind: 'static', title: '上传速度', content: `${calcTraffic(connection.uploadSpeed || 0)}/s` },
    {
      kind: 'static',
      title: '下载速度',
      content: `${calcTraffic(connection.downloadSpeed || 0)}/s`
    },
    { kind: 'static', title: '上传量', content: calcTraffic(connection.upload) },
    { kind: 'static', title: '下载量', content: calcTraffic(connection.download) },
    {
      kind: 'copy',
      title: '连接类型',
      value: [connection.metadata.type, connection.metadata.network],
      displayName: `${connection.metadata.type}(${connection.metadata.network})`,
      prefix: ['IN-TYPE', 'NETWORK']
    },
    ...(connection.metadata.host
      ? [
          {
            kind: 'copy' as const,
            title: '主机',
            value: connection.metadata.host,
            prefix: ['DOMAIN', 'DOMAIN-SUFFIX']
          }
        ]
      : []),
    ...(connection.metadata.sniffHost
      ? [
          {
            kind: 'copy' as const,
            title: '嗅探主机',
            value: connection.metadata.sniffHost,
            prefix: ['DOMAIN', 'DOMAIN-SUFFIX']
          }
        ]
      : []),
    ...(connection.metadata.process && connection.metadata.type != 'Inner'
      ? [
          {
            kind: 'copy' as const,
            title: '进程名',
            value: [
              connection.metadata.process,
              ...(connection.metadata.uid ? [connection.metadata.uid.toString()] : [])
            ],
            displayName: `${connection.metadata.process}${
              connection.metadata.uid ? `(${connection.metadata.uid})` : ''
            }`,
            prefix: ['PROCESS-NAME', ...(connection.metadata.uid ? ['UID'] : [])]
          }
        ]
      : []),
    ...(connection.metadata.processPath && connection.metadata.type != 'Inner'
      ? [
          {
            kind: 'copy' as const,
            title: '进程路径',
            value: connection.metadata.processPath,
            prefix: ['PROCESS-PATH']
          }
        ]
      : []),
    ...(connection.metadata.sourceIP
      ? [
          {
            kind: 'copy' as const,
            title: '来源 IP',
            value: connection.metadata.sourceIP,
            prefix: ['SRC-IP-CIDR']
          }
        ]
      : []),
    ...(connection.metadata.sourceGeoIP && connection.metadata.sourceGeoIP.length > 0
      ? [
          {
            kind: 'copy' as const,
            title: '来源 GeoIP',
            value: connection.metadata.sourceGeoIP,
            prefix: ['SRC-GEOIP']
          }
        ]
      : []),
    ...(connection.metadata.sourceIPASN
      ? [
          {
            kind: 'copy' as const,
            title: '来源 ASN',
            value: connection.metadata.sourceIPASN,
            prefix: ['SRC-IP-ASN']
          }
        ]
      : []),
    ...(connection.metadata.destinationIP
      ? [
          {
            kind: 'copy' as const,
            title: '目标 IP',
            value: connection.metadata.destinationIP,
            prefix: ['IP-CIDR']
          }
        ]
      : []),
    ...(connection.metadata.destinationGeoIP && connection.metadata.destinationGeoIP.length > 0
      ? [
          {
            kind: 'copy' as const,
            title: '目标 GeoIP',
            value: connection.metadata.destinationGeoIP,
            prefix: ['GEOIP']
          }
        ]
      : []),
    ...(connection.metadata.destinationIPASN
      ? [
          {
            kind: 'copy' as const,
            title: '目标 ASN',
            value: connection.metadata.destinationIPASN,
            prefix: ['IP-ASN']
          }
        ]
      : []),
    ...(connection.metadata.sourcePort
      ? [
          {
            kind: 'copy' as const,
            title: '来源端口',
            value: connection.metadata.sourcePort,
            prefix: ['SRC-PORT']
          }
        ]
      : []),
    ...(connection.metadata.destinationPort
      ? [
          {
            kind: 'copy' as const,
            title: '目标端口',
            value: connection.metadata.destinationPort,
            prefix: ['DST-PORT']
          }
        ]
      : []),
    ...(connection.metadata.inboundIP
      ? [
          {
            kind: 'copy' as const,
            title: '入站 IP',
            value: connection.metadata.inboundIP,
            prefix: ['SRC-IP-CIDR']
          }
        ]
      : []),
    ...(connection.metadata.inboundPort !== '0'
      ? [
          {
            kind: 'copy' as const,
            title: '入站端口',
            value: connection.metadata.inboundPort,
            prefix: ['SRC-PORT']
          }
        ]
      : []),
    ...(connection.metadata.inboundName
      ? [
          {
            kind: 'copy' as const,
            title: '入站名称',
            value: connection.metadata.inboundName,
            prefix: ['IN-NAME']
          }
        ]
      : []),
    ...(connection.metadata.inboundUser
      ? [
          {
            kind: 'copy' as const,
            title: '入站用户',
            value: connection.metadata.inboundUser,
            prefix: ['IN-USER']
          }
        ]
      : []),
    ...(connection.metadata.dscp !== 0
      ? [
          {
            kind: 'copy' as const,
            title: 'DSCP',
            value: connection.metadata.dscp.toString(),
            prefix: ['DSCP']
          }
        ]
      : []),
    ...(connection.metadata.remoteDestination
      ? [
          {
            kind: 'copy' as const,
            title: '远程目标',
            value: connection.metadata.remoteDestination,
            prefix: ['IP-CIDR']
          }
        ]
      : []),
    ...(connection.metadata.dnsMode
      ? [{ kind: 'static' as const, title: 'DNS 模式', content: connection.metadata.dnsMode }]
      : []),
    ...(connection.metadata.specialProxy
      ? [
          {
            kind: 'static' as const,
            title: '特殊代理',
            content: connection.metadata.specialProxy
          }
        ]
      : []),
    ...(connection.metadata.specialRules
      ? [
          {
            kind: 'static' as const,
            title: '特殊规则',
            content: connection.metadata.specialRules
          }
        ]
      : [])
  ]

  return (
    <Modal>
      <Modal.Backdrop
        isOpen={true}
        onOpenChange={onClose}
        variant="blur"
        className="top-12 h-[calc(100%-48px)]"
      >
        <Modal.Container scroll="inside">
          <Modal.Dialog className="w-[min(700px,calc(100%-24px))] max-w-none flag-emoji">
            <Modal.Header className="app-drag pb-0">
              <Modal.Heading>连接详情</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="no-scrollbar max-h-[70vh] overflow-y-auto pt-4 pb-4">
              <Surface variant="transparent" className="flex flex-col">
                {rows.map((row, index) => {
                  const hasSeparator = index < rows.length - 1

                  return row.kind === 'copy'
                    ? renderCopyableRow(row, hasSeparator)
                    : renderRow(row.title, row.content, undefined, hasSeparator)
                })}
              </Surface>
            </Modal.Body>
            <Modal.CloseTrigger className="app-nodrag" />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

export default ConnectionDetailModal
