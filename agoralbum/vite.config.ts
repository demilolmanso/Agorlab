import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/agoralbum/', // 👈 ESTO ES CLAVE: Le avisa a Vite que va en agorlab.com/agoralbum
})
