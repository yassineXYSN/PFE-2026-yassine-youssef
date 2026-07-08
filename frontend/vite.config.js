import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')

  // In deployment mode, extract the exact hostname from VITE_FRONTEND_URL
  // so Vite's host check accepts it regardless of tunnel provider
  const extraHosts = []
  if (env.VITE_FRONTEND_URL) {
    try {
      extraHosts.push(new URL(env.VITE_FRONTEND_URL).hostname)
    } catch {
      // invalid URL — skip
    }
  }

  return {
    plugins: [
      react(),
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/@mediapipe/tasks-vision/wasm/*',
            dest: 'mediapipe/wasm',
            rename: { stripBase: true },
          },
        ],
      }),
    ],
    server: {
      host: '0.0.0.0',
      allowedHosts: ['localhost', '.ngrok-free.dev', '.ngrok.io', '.trycloudflare.com', '.devtunnels.ms', ...extraHosts],
    },
  }
})
