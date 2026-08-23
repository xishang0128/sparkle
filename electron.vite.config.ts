import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
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
    plugins: [react(), tailwindcss()]
  }
})
