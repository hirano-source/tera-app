/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1c1c1e',
        topbar: '#1c1c1e',
        claude: '#6d5dfc',
        brand: '#2563eb',
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
