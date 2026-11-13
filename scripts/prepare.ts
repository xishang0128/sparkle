import fs from 'fs'
import axios from 'axios'
import { pipeline } from 'stream/promises'
import AdmZip from 'adm-zip'
import path from 'path'
import zlib from 'zlib'
import { extract } from 'tar'
import { systemCoreOnlyBuild } from './build-env.ts'

const cwd = process.cwd()
const TEMP_DIR = path.join(cwd, 'node_modules/.temp')
let arch: string = process.arch
const platform = process.platform
if (process.argv.slice(2).length !== 0) {
  arch = process.argv.slice(2)[0].replace('--', '')
}

if (process.env.SKIP_PREPARE === '1') {
  console.log('Skipping prepare script...')
  process.exit(0)
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function getPlatformAsset(map: Readonly<Partial<Record<string, string>>>): string {
  const name = map[`${platform}-${arch}`]
  if (!name) {
    throw new Error(`unsupported platform "${platform}-${arch}"`)
  }
  return name
}

/* ======= mihomo alpha======= */
const MIHOMO_ALPHA_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha/version.txt'
const MIHOMO_ALPHA_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download/Prerelease-Alpha`
let MIHOMO_ALPHA_VERSION: string

const MIHOMO_ALPHA_MAP = {
  'win32-x64': 'mihomo-windows-amd64-v3',
  'win32-ia32': 'mihomo-windows-386',
  'win32-arm64': 'mihomo-windows-arm64',
  'darwin-x64': 'mihomo-darwin-amd64-v3',
  'darwin-arm64': 'mihomo-darwin-arm64',
  'linux-x64': 'mihomo-linux-amd64-v3',
  'linux-arm64': 'mihomo-linux-arm64',
  'linux-loong64': 'mihomo-linux-loong64-abi2'
}

// Use Axios so HTTP(S)_PROXY and NO_PROXY apply to preparation downloads.
const downloadClient = axios.create({ timeout: 60_000 })

async function getLatestAlphaVersion() {
  const { data } = await downloadClient.get<string>(MIHOMO_ALPHA_VERSION_URL, {
    responseType: 'text'
  })
  MIHOMO_ALPHA_VERSION = data.trim()
  console.log(`Latest alpha version: ${MIHOMO_ALPHA_VERSION}`)
}

/* ======= mihomo release ======= */
const MIHOMO_VERSION_URL =
  'https://github.com/MetaCubeX/mihomo/releases/latest/download/version.txt'
const MIHOMO_URL_PREFIX = `https://github.com/MetaCubeX/mihomo/releases/download`
let MIHOMO_VERSION: string

const MIHOMO_MAP = {
  'win32-x64': 'mihomo-windows-amd64-v3',
  'win32-ia32': 'mihomo-windows-386',
  'win32-arm64': 'mihomo-windows-arm64',
  'darwin-x64': 'mihomo-darwin-amd64-v3',
  'darwin-arm64': 'mihomo-darwin-arm64',
  'linux-x64': 'mihomo-linux-amd64-v3',
  'linux-arm64': 'mihomo-linux-arm64',
  'linux-loong64': 'mihomo-linux-loong64-abi2'
}

async function getLatestReleaseVersion() {
  const { data } = await downloadClient.get<string>(MIHOMO_VERSION_URL, {
    responseType: 'text'
  })
  MIHOMO_VERSION = data.trim()
  console.log(`Latest release version: ${MIHOMO_VERSION}`)
}

/*
 * check available
 */
const MIHOMO_NAME = getPlatformAsset(MIHOMO_MAP)
const MIHOMO_ALPHA_NAME = getPlatformAsset(MIHOMO_ALPHA_MAP)

/**
 * core info
 */
function MihomoAlpha(): SidecarInfo {
  const name = MIHOMO_ALPHA_NAME
  const isWin = platform === 'win32'
  const urlExt = isWin ? 'zip' : 'gz'
  const downloadURL = `${MIHOMO_ALPHA_URL_PREFIX}/${name}-${MIHOMO_ALPHA_VERSION}.${urlExt}`
  const exeFile = `${name}${isWin ? '.exe' : ''}`
  const zipFile = `${name}-${MIHOMO_ALPHA_VERSION}.${urlExt}`

  return {
    name: 'mihomo-alpha',
    targetFile: `mihomo-alpha${isWin ? '.exe' : ''}`,
    exeFile,
    zipFile,
    downloadURL
  }
}

function mihomo(): SidecarInfo {
  const name = MIHOMO_NAME
  const isWin = platform === 'win32'
  const urlExt = isWin ? 'zip' : 'gz'
  const downloadURL = `${MIHOMO_URL_PREFIX}/${MIHOMO_VERSION}/${name}-${MIHOMO_VERSION}.${urlExt}`
  const exeFile = `${name}${isWin ? '.exe' : ''}`
  const zipFile = `${name}-${MIHOMO_VERSION}.${urlExt}`

  return {
    name: 'mihomo',
    targetFile: `mihomo${isWin ? '.exe' : ''}`,
    exeFile,
    zipFile,
    downloadURL
  }
}
interface SidecarInfo {
  name: string
  targetFile: string
  zipFile: string
  exeFile: string
  downloadURL: string
}

interface ResourceInfo {
  file: string
  downloadURL: string
  needExecutable?: boolean
}

/**
 * download sidecar and rename
 */
async function resolveSidecar(binInfo: SidecarInfo) {
  const { name, targetFile, zipFile, exeFile, downloadURL } = binInfo

  const sidecarDir = path.join(cwd, 'extra', 'sidecar')
  const sidecarPath = path.join(sidecarDir, targetFile)

  fs.mkdirSync(sidecarDir, { recursive: true })
  const tempDir = path.join(TEMP_DIR, name)
  const tempZip = path.join(tempDir, zipFile)
  const tempExe = path.join(tempDir, exeFile)

  fs.mkdirSync(tempDir, { recursive: true })
  try {
    if (!fs.existsSync(tempZip)) {
      await downloadFile(downloadURL, tempZip)
    }

    if (zipFile.endsWith('.zip')) {
      const zip = new AdmZip(tempZip)
      zip.getEntries().forEach((entry) => {
        console.log(`[DEBUG]: "${name}" entry name`, entry.entryName)
      })
      zip.extractAllTo(tempDir, true)
      console.log(`[INFO]: "${name}" unzip finished`)
    } else if (zipFile.endsWith('.tgz')) {
      // tgz
      fs.mkdirSync(tempDir, { recursive: true })
      await extract({
        cwd: tempDir,
        file: tempZip
      })
      const files = fs.readdirSync(tempDir)
      console.log(`[DEBUG]: "${name}" files in tempDir:`, files)
      const extractedFile = files.find((file) => file.startsWith('虚空终端-'))
      if (extractedFile) {
        const extractedFilePath = path.join(tempDir, extractedFile)
        fs.renameSync(extractedFilePath, tempExe)
        console.log(`[INFO]: "${name}" file renamed to "${sidecarPath}"`)
        fs.chmodSync(tempExe, 0o755)
        console.log(`[INFO]: "${name}" chmod binary finished`)
      } else {
        throw new Error(`Expected file not found in ${tempDir}`)
      }
    } else {
      // gz
      await pipeline(
        fs.createReadStream(tempZip),
        zlib.createGunzip(),
        fs.createWriteStream(tempExe)
      )
      fs.chmodSync(tempExe, 0o755)
      console.log(`[INFO]: "${name}" gunzip finished`)
    }
    // Keep any existing binary until the replacement has downloaded and extracted.
    fs.renameSync(tempExe, sidecarPath)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

/**
 * download the file to the extra dir
 */
async function resolveResource(binInfo: ResourceInfo) {
  const { file, downloadURL, needExecutable = false } = binInfo

  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, file)

  fs.mkdirSync(resDir, { recursive: true })
  await downloadFile(downloadURL, targetPath)

  if (needExecutable && platform !== 'win32') {
    fs.chmodSync(targetPath, 0o755)
    console.log(`[INFO]: ${file} chmod finished`)
  }

  console.log(`[INFO]: ${file} finished`)
}

/**
 * download file and save to `path`
 */
async function downloadFile(url: string, targetPath: fs.PathOrFileDescriptor) {
  const { data } = await downloadClient.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer'
  })
  fs.writeFileSync(targetPath, new Uint8Array(data))

  console.log(`[INFO]: download finished "${url}"`)
}

const resolveMmdb = () =>
  resolveResource({
    file: 'country.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb`
  })
const resolveMetadb = () =>
  resolveResource({
    file: 'geoip.metadb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb`
  })
const resolveGeosite = () =>
  resolveResource({
    file: 'geosite.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat`
  })
const resolveGeoIP = () =>
  resolveResource({
    file: 'geoip.dat',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat`
  })
const resolveASN = () =>
  resolveResource({
    file: 'ASN.mmdb',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb`
  })
const resolveBundleMRS = () =>
  resolveResource({
    file: 'BundleMRS.7z',
    downloadURL: `https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/BundleMRS.7z`
  })
const resolveEnableLoopback = () =>
  resolveResource({
    file: 'enableLoopback.exe',
    downloadURL: `https://github.com/Kuingsmile/uwp-tool/releases/download/latest/enableLoopback.exe`
  })
const resolveSparkleService = () => {
  const map = {
    'win32-x64': 'sparkle-service-windows-amd64-v3',
    'win32-ia32': 'sparkle-service-windows-386',
    'win32-arm64': 'sparkle-service-windows-arm64',
    'darwin-x64': 'sparkle-service-darwin-amd64-v3',
    'darwin-arm64': 'sparkle-service-darwin-arm64',
    'linux-x64': 'sparkle-service-linux-amd64-v3',
    'linux-arm64': 'sparkle-service-linux-arm64',
    'linux-loong64': 'sparkle-service-linux-loong64-abi2'
  }
  const base = getPlatformAsset(map)
  const ext = platform == 'win32' ? '.exe' : ''

  return resolveResource({
    file: `sparkle-service${ext}`,
    downloadURL: `https://github.com/UruhaLushia/sparkle-service/releases/download/pre-release/${base}${ext}`,
    needExecutable: true
  })
}
const resolveRunner = () =>
  resolveResource({
    file: 'sparkle-run.exe',
    downloadURL: `https://github.com/xishang0128/sparkle-run/releases/download/${arch}/sparkle-run.exe`
  })

const resolveMonitor = async () => {
  const tempDir = path.join(TEMP_DIR, 'TrafficMonitor')
  const tempZip = path.join(tempDir, `${arch}.zip`)
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  await downloadFile(
    `https://github.com/xishang0128/sparkle-run/releases/download/monitor/${arch}.zip`,
    tempZip
  )
  const zip = new AdmZip(tempZip)
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'TrafficMonitor')
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  zip.extractAllTo(targetPath, true)

  console.log(`[INFO]: TrafficMonitor finished`)
}

const resolve7zip = () =>
  resolveResource({
    file: '7za.exe',
    downloadURL: `https://github.com/develar/7zip-bin/raw/master/win/${arch}/7za.exe`
  })
const resolveSubstore = () =>
  resolveResource({
    file: 'sub-store.bundle.js',
    downloadURL:
      'https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js'
  })
const resolveSubstoreFrontend = async () => {
  const tempDir = path.join(TEMP_DIR, 'substore-frontend')
  const tempZip = path.join(tempDir, 'dist.zip')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  await downloadFile(
    'https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip',
    tempZip
  )
  const zip = new AdmZip(tempZip)
  const resDir = path.join(cwd, 'extra', 'files')
  const targetPath = path.join(resDir, 'sub-store-frontend')
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true })
  }
  zip.extractAllTo(resDir, true)
  fs.renameSync(path.join(resDir, 'dist'), targetPath)

  if (platform !== 'win32') {
    try {
      const fixPermissions = (dir: string): void => {
        const items = fs.readdirSync(dir, { withFileTypes: true })
        for (const item of items) {
          const fullPath = path.join(dir, item.name)
          if (item.isDirectory()) {
            fs.chmodSync(fullPath, 0o755)
            fixPermissions(fullPath)
          } else {
            fs.chmodSync(fullPath, 0o644)
          }
        }
      }
      fs.chmodSync(targetPath, 0o755)
      fixPermissions(targetPath)
      console.log(`[INFO]: sub-store-frontend permissions fixed`)
    } catch (error) {
      console.warn(`[WARN]: Failed to fix permissions: ${getErrorMessage(error)}`)
    }
  }

  console.log(`[INFO]: sub-store-frontend finished`)
}
const resolveFont = async () => {
  // const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'NotoColorEmoji.ttf')
  const targetPath = path.join(cwd, 'src', 'renderer', 'src', 'assets', 'twemoji.ttf')

  if (fs.existsSync(targetPath)) {
    return
  }
  await downloadFile(
    // 'https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf',
    'https://github.com/Sav22999/emoji/raw/refs/heads/master/font/twemoji.ttf',
    targetPath
  )

  console.log(`[INFO]: twemoji.ttf finished`)
}

type Task = {
  name: string
  func: () => Promise<void>
  retry: number
  winOnly?: boolean
  linuxOnly?: boolean
  unixOnly?: boolean
}

const tasks: Task[] = [
  {
    name: 'mihomo-alpha',
    func: () => getLatestAlphaVersion().then(() => resolveSidecar(MihomoAlpha())),
    retry: 5
  },
  {
    name: 'mihomo',
    func: () => getLatestReleaseVersion().then(() => resolveSidecar(mihomo())),
    retry: 5
  },
  { name: 'mmdb', func: resolveMmdb, retry: 5 },
  { name: 'metadb', func: resolveMetadb, retry: 5 },
  { name: 'geosite', func: resolveGeosite, retry: 5 },
  { name: 'geoip', func: resolveGeoIP, retry: 5 },
  { name: 'asn', func: resolveASN, retry: 5 },
  { name: 'bundlemrs', func: resolveBundleMRS, retry: 5 },
  {
    name: 'font',
    func: resolveFont,
    retry: 5
  },
  {
    name: 'enableLoopback',
    func: resolveEnableLoopback,
    retry: 5,
    winOnly: true
  },
  {
    name: 'sparkle-service',
    func: resolveSparkleService,
    retry: 5
  },
  {
    name: 'runner',
    func: resolveRunner,
    retry: 5,
    winOnly: true
  },
  {
    name: 'monitor',
    func: resolveMonitor,
    retry: 5,
    winOnly: true
  },
  {
    name: 'substore',
    func: resolveSubstore,
    retry: 5
  },
  {
    name: 'substorefrontend',
    func: resolveSubstoreFrontend,
    retry: 5
  },
  {
    name: '7zip',
    func: resolve7zip,
    retry: 5,
    winOnly: true
  }
]

if (systemCoreOnlyBuild) {
  tasks.splice(0, 2)
  console.log('[INFO]: System-core-only build: skipping mihomo downloads')
}

async function runTask(): Promise<void> {
  const task = tasks.shift()
  if (!task) return
  if (task.winOnly && platform !== 'win32') return runTask()
  if (task.linuxOnly && platform !== 'linux') return runTask()
  if (task.unixOnly && platform === 'win32') return runTask()

  for (let i = 0; i < task.retry; i++) {
    try {
      await task.func()
      break
    } catch (err) {
      console.error(`[ERROR]: task::${task.name} try ${i} ==`, getErrorMessage(err))
      if (i === task.retry - 1) throw err
    }
  }
  return runTask()
}

Promise.all([runTask(), runTask()]).catch((error: unknown) => {
  console.error('[ERROR]: Preparation failed:', getErrorMessage(error))
  process.exitCode = 1
})
