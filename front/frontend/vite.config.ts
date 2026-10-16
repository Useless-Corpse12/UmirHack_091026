import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',  // ← ROOT уровень: относительные пути для портативности
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:5000',
      '/hubs': {
        target: 'ws://localhost:5000',
        ws: true
      }  // ← теперь закрыто правильно
    }
  }
})