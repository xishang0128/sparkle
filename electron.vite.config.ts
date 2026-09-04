import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { systemCoreDefaultPath, systemCoreOnlyBuild, systemServicePath } from './scripts/build-env'

const buildDefines = {
  __SPARKLE_SYSTEM_CORE_PATH__: JSON.stringify(systemCoreDefaultPath),
  __SPARKLE_SYSTEM_SERVICE_PATH__: JSON.stringify(systemServicePath)
}
const omitExternalRendererResources = {
  name: 'omit-external-renderer-resources',
  enforce: 'pre' as const,
  transform(source: string, id: string): string | undefined {
    if (!systemCoreOnlyBuild || !id.endsWith('/src/renderer/src/assets/main.css')) return
    return source.replace(/@font-face\s*\{[^}]*twemoji\.ttf[^}]*\}/, '')
  }
}

export default defineConfig({
  main: {
    define: buildDefines,
    build: {
      externalizeDeps: {
        exclude: ['age-encryption']
      }
    }
  },
  preload: {
    build: {
      externalizeDeps: true
    }
  },
  renderer: {
    define: buildDefines,
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          floating: resolve('src/renderer/floating.html'),
          traymenu: resolve('src/renderer/traymenu.html')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [omitExternalRendererResources, react(), tailwindcss()]
  }
})
