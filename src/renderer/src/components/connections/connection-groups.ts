export type ConnectionGroupSort =
  | 'name'
  | 'count'
  | 'upload'
  | 'download'
  | 'uploadSpeed'
  | 'downloadSpeed'

export interface ConnectionGroup {
  key: string
  label: string
  process: string
  processPath: string
  sourceIP: string
  count: number
  upload: number
  download: number
  uploadSpeed: number
  downloadSpeed: number
  connections: ControllerConnectionDetail[]
}

export function groupKey(conn: ControllerConnectionDetail): string {
  const process = conn.metadata.process || ''
  return process !== '' ? process : conn.metadata.sourceIP || ''
}

export function buildConnectionGroups(
  connections: ControllerConnectionDetail[],
  sort: ConnectionGroupSort,
  asc: boolean
): ConnectionGroup[] {
  const groups = new Map<string, ConnectionGroup>()

  for (const conn of connections) {
    const key = groupKey(conn)
    const process = conn.metadata.process || ''
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        label: process !== '' ? process : conn.metadata.sourceIP || '',
        process,
        processPath: conn.metadata.processPath || '',
        sourceIP: conn.metadata.sourceIP || '',
        count: 0,
        upload: 0,
        download: 0,
        uploadSpeed: 0,
        downloadSpeed: 0,
        connections: []
      }
      groups.set(key, group)
    }

    group.count += 1
    group.upload += conn.upload || 0
    group.download += conn.download || 0
    group.uploadSpeed += conn.uploadSpeed || 0
    group.downloadSpeed += conn.downloadSpeed || 0
    group.connections.push(conn)
    if (!group.processPath && conn.metadata.processPath) {
      group.processPath = conn.metadata.processPath
    }
  }

  const rows = Array.from(groups.values())
  sortGroups(rows, sort, asc)
  return rows
}

function sortGroups(rows: ConnectionGroup[], sort: ConnectionGroupSort, asc: boolean): void {
  const dir = asc ? 1 : -1
  let comparator: (a: ConnectionGroup, b: ConnectionGroup) => number
  switch (sort) {
    case 'count':
      comparator = (a, b) => (a.count - b.count) * dir
      break
    case 'upload':
      comparator = (a, b) => (a.upload - b.upload) * dir
      break
    case 'download':
      comparator = (a, b) => (a.download - b.download) * dir
      break
    case 'uploadSpeed':
      comparator = (a, b) => (a.uploadSpeed - b.uploadSpeed) * dir
      break
    case 'downloadSpeed':
      comparator = (a, b) => (a.downloadSpeed - b.downloadSpeed) * dir
      break
    case 'name':
    default:
      comparator = (a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()) * dir
      break
  }
  rows.sort(comparator)
}
