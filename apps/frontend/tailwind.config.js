/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#A020F0',
          secondary: '#7B2FFF',
          background: '#050508',
          surface: '#100D17',
          text: '#F5F3FA',
          muted: '#A39BAD',
          neon: '#A020F0',
          violet: '#7B2FFF',
        },
        background: '#050508',
        surface: {
          DEFAULT: '#100D17',
          raised: '#171322',
          overlay: '#1F1930',
        },
        border: {
          DEFAULT: '#262035',
          subtle: '#1C1728',
          medium: '#362E4D',
          strong: '#544778',
          accent: '#A020F0',
        },
        primary: {
          DEFAULT: '#A020F0',
          hover: '#7B2FFF',
          light: '#F5F3FA',
        },
        accent: {
          DEFAULT: '#A020F0',
          hover: '#7B2FFF',
        },
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        text: {
          DEFAULT: '#F5F3FA',
          muted: '#A39BAD',
          dim: '#6D657A',
        },
      },
      fontFamily: {
        display: ['"Archivo Black"', 'Impact', '"Arial Black"', 'sans-serif'],
        sans: ['"Work Sans"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['"Space Mono"', '"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'brand-glow': '0 0 25px -5px rgba(160, 32, 240, 0.35)',
        'brand-glow-sm': '0 0 15px -3px rgba(160, 32, 240, 0.25)',
      },
    },
  },
  plugins: [],
}
