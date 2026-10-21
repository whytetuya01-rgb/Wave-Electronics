/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#141414',
          hover: '#1C1C1C',
        },
        charcoal: {
          DEFAULT: '#1C1C1C',
          dark: '#141414',
          secondary: '#303030',
        },
        gold: {
          light: '#E8E6E2',
          DEFAULT: '#A69B8D',
          deep: '#807365',
        },
        page: '#F7F6F3',
        card: '#FFFFFF',
        sidebar: {
          bg: '#141414',
          active: '#1F1E1D',
          hover: '#1C1B1A',
          border: '#282725',
        },
        border: {
          DEFAULT: '#E6E3DE',
          subtle: '#E8E6E2',
          dark: '#303030',
        },
        surface: {
          primary: '#171717',
          secondary: '#6B6863',
          muted: '#8E8A84',
        },
        status: {
          success: '#168060',
          warning: '#B7791F',
          error: '#C2413A',
        },
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.04)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.03)',
        'card': '0 1px 2px 0 rgba(20, 20, 20, 0.03)',
        'dropdown': '0 4px 12px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.2)',
      },
      // 4.5 (18px) is used across the app (p-4.5, h-4.5, w-4.5...) but isn't in
      // Tailwind's default scale, so those classes previously generated no CSS
      // at all - e.g. the inward-entry details panel had zero padding and the
      // sidebar's active-page indicator pill had zero height.
      spacing: {
        '4.5': '1.125rem',
      },
      borderRadius: {
        'btn': '10px',
        'card': '12px',
      },
      transitionDuration: {
        '120': '120ms',
        '180': '180ms',
        '220': '220ms',
        '240': '240ms',
        '300': '300ms',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'page-enter': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'dialog-in': {
          '0%': { opacity: '0', transform: 'scale(0.98) translateY(4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'backdrop-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      animation: {
        'page-enter': 'page-enter 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in-up': 'fade-in-up 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'dialog-in': 'dialog-in 180ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'backdrop-in': 'backdrop-in 180ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
    },
  },
  plugins: [],
}
