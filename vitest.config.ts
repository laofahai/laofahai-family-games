import { defineConfig } from 'vitest/config'
import path from 'path'

// 测试专用配置：只跑「纯逻辑模块」的单元测试（不依赖 Phaser/浏览器 DOM）。
// 路径别名与 vite.config.ts / tsconfig.app.json 保持一致：'@' → src。
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
