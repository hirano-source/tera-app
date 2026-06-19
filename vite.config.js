import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 本番ビルド（GitHub Pagesプロジェクトサイト）だけ base を /tera-app/ に。
// dev はルート（/）のまま＝ローカルプレビューを壊さない。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/tera-app/' : '/',
  plugins: [react()],
  server: {
    host: true,
  },
}))
