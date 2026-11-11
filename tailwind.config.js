/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./dashboard.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./test-pages/**/*.{html,js}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          forest: '#173D32',
          primary: '#249B68',
          light: '#EAF5EE',
          canvas: '#F5F7F5',
          navy: '#253449',
          border: '#E4EAE5',
          muted: '#718096',
        },
        petro: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          header: '#5a9e78',
          card: '#eef6f1',
        },
        navy: {
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Bengali', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
