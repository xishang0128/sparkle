import { exec, execFile, execSync, spawn } from 'child_process'
import { app, dialog, nativeTheme, shell } from 'electron'
import { readFile } from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import { setupFirewallRules } from '@uruhalushia/sparkle-native'
import {
  dataDir,
  exePath,
  mihomoCorePath,
  overridePath,
  profilePath,
  resourcesDir,
  resourcesFilesDir,
  taskDir
} from '../utils/dirs'
import { copyFileSync, writeFileSync } from 'fs'
import { execWithElevation } from '../utils/elevation'

export function getFilePath(
  ext: string[],
  title = '选择订阅文件',
  filterName = `${ext} file`
): string[] | undefined {
  return dialog.showOpenDialogSync({
    title,
    filters: [{ name: filterName, extensions: ext }],
    properties: ['openFile']
  })
}

export async function readTextFile(filePath: string): Promise<string> {
  return await readFile(filePath, 'utf8')
}

export async function readImageFileDataURL(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase()
  const mimeType =
    ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png'
  const data = await readFile(filePath)

  return `data:${mimeType};base64,${data.toString('base64')}`
}

export function openFile(type: 'profile' | 'override', id: string, ext?: 'yaml' | 'js'): void {
  if (type === 'profile') {
    shell.openPath(profilePath(id))
  }
  if (type === 'override') {
    shell.openPath(overridePath(id, ext || 'js'))
  }
}

export async function openUWPTool(): Promise<void> {
  const execFilePromise = promisify(execFile)
  const uwpToolPath = path.join(resourcesDir(), 'files', 'enableLoopback.exe')
  await execFilePromise(uwpToolPath)
}

export async function setupFirewall(): Promise<void> {
  if (process.platform === 'win32') {
    setupFirewallRules([
      { name: 'mihomo', applicationPath: mihomoCorePath('mihomo') },
      { name: 'mihomo-alpha', applicationPath: mihomoCorePath('mihomo-alpha') },
      { name: 'Sparkle', applicationPath: exePath() }
    ])
  }
}

// TUN 模式启动前被重置 forwarding 的网卡接口索引，用于 TUN 关闭时恢复
let forwardingResetInterfaceIndexes: number[] = []

/**
 * 解析 PowerShell 输出的逗号分隔接口索引列表
 */
function parseInterfaceIndexes(output: string): number[] {
  return Array.from(
    new Set(
      output
        .trim()
        .split(',')
        .map((item) => Number.parseInt(item.trim(), 10))
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  )
}

/**
 * 重置活跃物理网卡的 IPv4 Forwarding 状态，防止 TUN 模式无网络
 *
 * 在某些 Windows 系统中，物理网卡的 IP forwarding 被异常启用
 * （可能由 VPN/虚拟机/ICS 残留），导致 WFP 将 TUN 流量分类到
 * IPFORWARD 层而非 IPLOCAL 层，从而被错误过滤。
 *
 * 仅操作持有默认路由(0.0.0.0/0)的活跃 IPv4 接口，
 * 使用 InterfaceIndex 定位以避免本地化接口名问题。
 *
 * @see https://github.com/clash-verge-rev/clash-verge-rev/issues/244
 * @returns 被重置的接口数量
 */
export async function resetForwardingForTun(): Promise<number> {
  if (process.platform !== 'win32') return 0

  const execPromise = promisify(exec)
  const script = `
$ErrorActionPreference = 'Stop'
$indexes = @(Get-NetRoute -AddressFamily IPv4 -DestinationPrefix "0.0.0.0/0" -ErrorAction Stop |
  Select-Object -ExpandProperty InterfaceIndex -Unique)
$updated = @()
foreach ($index in $indexes) {
  try {
    $iface = Get-NetIPInterface -InterfaceIndex $index -AddressFamily IPv4 -ErrorAction Stop
    if ($iface.Forwarding -ne "Enabled") { continue }
    Set-NetIPInterface -InterfaceIndex $index -AddressFamily IPv4 -Forwarding Disabled -PolicyStore ActiveStore -ErrorAction Stop
    $updated += [int]$index
  } catch {
    continue
  }
}
($updated | Sort-Object -Unique) -join ","
`

  const { stdout } = await execPromise(script, { shell: 'powershell' })
  forwardingResetInterfaceIndexes = parseInterfaceIndexes(stdout)
  return forwardingResetInterfaceIndexes.length
}

/**
 * 恢复先前被 resetForwardingForTun 重置的网卡 forwarding 状态
 *
 * @returns 被恢复的接口数量
 */
export async function recoverForwardingForTun(): Promise<number> {
  if (process.platform !== 'win32') return 0
  if (forwardingResetInterfaceIndexes.length === 0) return 0

  const indexes = [...forwardingResetInterfaceIndexes]

  const execPromise = promisify(exec)
  const script = `
$ErrorActionPreference = 'Stop'
$indexes = @(${indexes.join(',')})
foreach ($index in $indexes) {
  try {
    Set-NetIPInterface -InterfaceIndex $index -AddressFamily IPv4 -Forwarding Enabled -PolicyStore ActiveStore -ErrorAction Stop
  } catch {
    continue
  }
}
`

  await execPromise(script, { shell: 'powershell' })
  // 仅在恢复执行成功后才清除索引列表，失败时保留以供后续重试
  forwardingResetInterfaceIndexes = []
  return indexes.length
}

export function setNativeTheme(theme: 'system' | 'light' | 'dark'): void {
  nativeTheme.themeSource = theme
}

const elevateTaskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <Triggers />
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>Parallel</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>false</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>3</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>"${path.join(taskDir(), `sparkle-run.exe`)}"</Command>
      <Arguments>"${exePath()}"</Arguments>
    </Exec>
  </Actions>
</Task>
`

function prepareElevateTaskFile(): string {
  const taskFilePath = path.join(taskDir(), `sparkle-run.xml`)
  writeFileSync(taskFilePath, Buffer.from(`\ufeff${elevateTaskXml}`, 'utf-16le'))
  copyFileSync(
    path.join(resourcesFilesDir(), 'sparkle-run.exe'),
    path.join(taskDir(), 'sparkle-run.exe')
  )
  return taskFilePath
}

export function createElevateTaskSync(): void {
  const taskFilePath = prepareElevateTaskFile()
  execSync(
    `%SystemRoot%\\System32\\schtasks.exe /create /tn "sparkle-run" /xml "${taskFilePath}" /f`
  )
}

export async function createElevateTask(): Promise<void> {
  const taskFilePath = prepareElevateTaskFile()
  await execWithElevation('schtasks.exe', [
    '/create',
    '/tn',
    'sparkle-run',
    '/xml',
    taskFilePath,
    '/f'
  ])
}

export async function deleteElevateTask(): Promise<void> {
  try {
    execSync(`%SystemRoot%\\System32\\schtasks.exe /delete /tn "sparkle-run" /f`)
  } catch {
    // ignore
  }
}

export async function checkElevateTask(): Promise<boolean> {
  try {
    execSync(`%SystemRoot%\\System32\\schtasks.exe /query /tn "sparkle-run"`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export function resetAppConfig(): void {
  if (process.platform === 'win32') {
    spawn(
      'cmd',
      [
        '/C',
        `"timeout /t 2 /nobreak >nul && rmdir /s /q "${dataDir()}" && start "" "${exePath()}""`
      ],
      {
        shell: true,
        detached: true
      }
    ).unref()
  } else {
    const script = `while kill -0 ${process.pid} 2>/dev/null; do
  sleep 0.1
done
  rm -rf '${dataDir()}'
  ${process.argv.join(' ')} & disown
exit
`
    spawn('sh', ['-c', `"${script}"`], {
      shell: true,
      detached: true,
      stdio: 'ignore'
    })
  }
  app.quit()
}
