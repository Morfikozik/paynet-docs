/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paynet: {
          // Primary brand colors from paynet.md
          primary: 'rgb(106, 180, 184)', // PayNet main teal
          secondary: 'rgb(85, 144, 148)', // Darker teal
          accent: 'rgb(127, 196, 200)', // Light teal accent
          dark: 'rgb(64, 108, 111)', // Very dark teal
          light: 'rgb(240, 248, 249)', // Very light teal
          orange: '#ff6600', // PayNet orange accent
          'orange-light': '#fff3e6', // Light orange
          // Success and status colors
          success: '#00cc66',
          warning: '#ff9900',
          error: '#cc0000',
          // Gray scale matching Paynet
          gray: {
            50: '#f8fafc',
            100: '#f1f5f9',
            200: '#e2e8f0',
            300: '#cbd5e1',
            400: '#94a3b8',
            500: '#64748b',
            600: '#475569',
            700: '#334155',
            800: '#1e293b',
            900: '#0f172a'
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'], // Modern font stack
      },
      boxShadow: {
        'paynet': '0 1px 3px rgba(106, 180, 184, 0.1), 0 1px 2px rgba(106, 180, 184, 0.06)',
        'paynet-lg': '0 4px 6px rgba(106, 180, 184, 0.07), 0 2px 4px rgba(106, 180, 184, 0.06)',
        'paynet-xl': '0 10px 15px rgba(106, 180, 184, 0.1), 0 4px 6px rgba(106, 180, 184, 0.05)',
      },
      borderRadius: {
        'paynet': '6px',
      },
      width: {
        '144': '36rem', // 576px (w-96 = 384px * 1.5 = 576px)
      }
    },
  },
  plugins: [],
};