import { spawnSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'
import { parse } from 'yaml'
import { systemCoreOnlyBuild } from './build-env.ts'

interface PackageTargetConfig {
  beforeInstall?: unknown
  afterInstall?: unknown
  beforeRemove?: unknown
  afterRemove?: unknown
  fpm?: unknown[]
}

interface BuilderConfig {
  files?: unknown[]
  extraResources?: unknown[]
  deb?: PackageTargetConfig
  rpm?: PackageTargetConfig
  pacman?: PackageTargetConfig
}

function createSystemPackageConfig(): BuilderConfig {
  const config = parse(readFileSync('electron-builder.yml', 'utf8')) as BuilderConfig
  config.files = [...(config.files || []), '!build/linux/preinst', '!build/linux/postinst']
  config.extraResources = []

  for (const target of [config.deb, config.rpm, config.pacman]) {
    if (!target) continue
    delete target.beforeInstall
    delete target.afterInstall
    delete target.beforeRemove
    delete target.afterRemove
    target.fpm = target.fpm?.filter(
      (entry) => typeof entry !== 'string' || !/^--(before|after)-(install|remove)(=|$)/.test(entry)
    )
    if (target.fpm?.length === 0) delete target.fpm
  }

  return config
}

const electronBuilder = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder'
)
const args = ['--publish', 'never', '--linux', ...process.argv.slice(2)]
let tempConfigDir: string | undefined

if (systemCoreOnlyBuild) {
  tempConfigDir = mkdtempSync(path.join(os.tmpdir(), 'sparkle-electron-builder-'))
  const configPath = path.join(tempConfigDir, 'config.json')
  writeFileSync(configPath, JSON.stringify(createSystemPackageConfig()))
  args.unshift('--config', configPath)
}

try {
  const result = spawnSync(electronBuilder, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  if (tempConfigDir) rmSync(tempConfigDir, { recursive: true, force: true })
}
