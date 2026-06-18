import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/agoralbum/', // 👈 ESTO ES CRUCIAL para que no quede la pantalla en blanco
})
