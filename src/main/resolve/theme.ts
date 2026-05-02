import { copyFile, readdir, readFile, writeFile } from 'fs/promises'
import { themesDir } from '../utils/dirs'
import path from 'path'
import axios from 'axios'
import AdmZip from 'adm-zip'
import { getControledMihomoConfig } from '../config'
import { existsSync } from 'fs'
import { mainWindow } from '..'
import { floatingWindow } from './floatingWindow'

let insertedCSSKeyMain: string | undefined = undefined
let insertedCSSKeyFloating: string | undefined = undefined

function normalizeThemeCss(css: string): string {
  const hasLegacyHeroUIVars = /--heroui-(primary|secondary|warning|danger)\s*:/i.test(css)

  if (!hasLegacyHeroUIVars) return css

  const hasToken = (token: string): boolean => {
    return new RegExp(`--${token}\\s*:`, 'i').test(css)
  }

  const declarations = [
    !hasToken('accent') && '  --accent: hsl(var(--heroui-primary)) !important;',
    !hasToken('accent-foreground') &&
      '  --accent-foreground: hsl(var(--heroui-primary-foreground, 0 0% 100%)) !important;',
    !hasToken('color-accent') && '  --color-accent: var(--accent) !important;',
    !hasToken('color-accent-foreground') &&
      '  --color-accent-foreground: var(--accent-foreground) !important;',
    !hasToken('secondary') &&
      '  --secondary: hsl(var(--heroui-secondary, var(--heroui-primary))) !important;',
    !hasToken('secondary-foreground') &&
      '  --secondary-foreground: hsl(var(--heroui-secondary-foreground, 0 0% 100%)) !important;',
    !hasToken('success') && '  --success: hsl(var(--heroui-success, 145 79% 44%)) !important;',
    !hasToken('success-foreground') &&
      '  --success-foreground: hsl(var(--heroui-success-foreground, 0 0% 100%)) !important;',
    !hasToken('warning') && '  --warning: hsl(var(--heroui-warning, 37 91% 55%)) !important;',
    !hasToken('warning-foreground') &&
      '  --warning-foreground: hsl(var(--heroui-warning-foreground, 0 0% 0%)) !important;',
    !hasToken('danger') && '  --danger: hsl(var(--heroui-danger, 339 90% 51%)) !important;',
    !hasToken('danger-foreground') &&
      '  --danger-foreground: hsl(var(--heroui-danger-foreground, 0 0% 100%)) !important;',
    '  --segment: hsl(var(--heroui-primary)) !important;',
    '  --segment-foreground: hsl(var(--heroui-primary-foreground, 0 0% 100%)) !important;',
    !hasToken('color-segment') && '  --color-segment: var(--segment) !important;',
    !hasToken('color-segment-foreground') &&
      '  --color-segment-foreground: var(--segment-foreground) !important;',
    !hasToken('focus') && '  --focus: hsl(var(--heroui-focus, var(--heroui-primary))) !important;'
  ].filter(Boolean)

  if (declarations.length === 0) return css

  return `${css}

/* Sparkle compatibility: HeroUI v2 -> v3 token bridge */
.dark,
.light,
.default,
[data-theme='dark'],
[data-theme='light'],
[data-theme='default'] {
${declarations.join('\n')}
}`
}

export async function resolveThemes(): Promise<{ key: string; label: string }[]> {
  const files = await readdir(themesDir())
  const themes = await Promise.all(
    files
      .filter((file) => file.endsWith('.css'))
      .map(async (file) => {
        const css = (await readFile(path.join(themesDir(), file), 'utf-8')) || ''
        let name = file
        if (css.startsWith('/*')) {
          name = css.split('\n')[0].replace('/*', '').replace('*/', '').trim() || file
        }
        return { key: file, label: name }
      })
  )
  if (themes.find((theme) => theme.key === 'default.css')) {
    return themes
  } else {
    return [{ key: 'default.css', label: '默认' }, ...themes]
  }
}

export async function fetchThemes(): Promise<void> {
  const zipUrl = 'https://github.com/mihomo-party-org/theme-hub/releases/download/latest/themes.zip'
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const zipData = await axios.get(zipUrl, {
    responseType: 'arraybuffer',
    headers: { 'Content-Type': 'application/octet-stream' },
    ...(mixedPort != 0 && {
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    })
  })
  const zip = new AdmZip(zipData.data as Buffer)
  zip.extractAllTo(themesDir(), true)
}

export async function importThemes(files: string[]): Promise<void> {
  for (const file of files) {
    if (existsSync(file))
      await copyFile(
        file,
        path.join(themesDir(), `${new Date().getTime().toString(16)}-${path.basename(file)}`)
      )
  }
}

export async function readTheme(theme: string): Promise<string> {
  if (!existsSync(path.join(themesDir(), theme))) return ''
  return await readFile(path.join(themesDir(), theme), 'utf-8')
}

export async function writeTheme(theme: string, css: string): Promise<void> {
  await writeFile(path.join(themesDir(), theme), css)
}

export async function applyTheme(theme: string): Promise<void> {
  const css = normalizeThemeCss(await readTheme(theme))
  await mainWindow?.webContents.removeInsertedCSS(insertedCSSKeyMain || '')
  insertedCSSKeyMain = await mainWindow?.webContents.insertCSS(css)
  try {
    await floatingWindow?.webContents.removeInsertedCSS(insertedCSSKeyFloating || '')
    insertedCSSKeyFloating = await floatingWindow?.webContents.insertCSS(css)
  } catch {
    // ignore
  }
}
