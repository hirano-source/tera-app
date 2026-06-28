/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1c1c1e',
        topbar: '#1c1c1e',
        claude: '#6d5dfc',
        brand: '#C04A2B', // Savoブランド＝テラコッタ（オレンジ系）
        // ゴルおじ酒場の世界観（昭和の大衆酒場・赤提灯）。大目標サーフェスで使う。
        cream: '#F3EEE3',
        ink: '#1A1714',
        sumi: '#6B635B',
        terracotta: '#C04A2B',
        lantern: '#CC2A2A',
        matcha: '#5E8C61',
        hairline: '#E4DCCC',
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          '"Hiragino Kaku Gothic ProN"',
          '"Hiragino Sans"',
          'Meiryo',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}
