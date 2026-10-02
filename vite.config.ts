import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [
    // JSX o'z ishlab chiqaruvchimizdan o'tadi — shunda interfeysdagi
    // matnlar bitta joyda tarjima qilinadi (src/lib/i18n-runtime).
    react({ jsxImportSource: '@i18n' }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@i18n': path.resolve(__dirname, './src/lib/i18n-runtime'),
    },
  },
  // JSX ishlab chiqaruvchi — loyihaning o'z fayli, tashqi paket emas.
  // Vite uni baribir dep sifatida oldindan to'playdi va kesh eskirsa
  // o'zgarish ko'rinmay qoladi; shuning uchun optimizatsiyadan chiqaramiz.
  optimizeDeps: { exclude: ['@i18n/jsx-runtime', '@i18n/jsx-dev-runtime'] },
  server: { port: Number(process.env.PORT) || 5173 },
})
