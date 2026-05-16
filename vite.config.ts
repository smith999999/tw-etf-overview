import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/tw-etf-overview/',
  plugins: [react()],
  server: {
    proxy: {
      '/api/finmind': {
        target: 'https://api.finmindtrade.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/finmind/, ''),
      },
      '/api/twse-mis': {
        target: 'https://mis.twse.com.tw',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/twse-mis/, ''),
      },
    },
  },
})
