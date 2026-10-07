/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        waffle: {
          50: '#FDF8F0',
          100: '#FAF0DE',
          200: '#F5DEB3',
          300: '#F4C468',
          400: '#E89D25',
          500: '#D97706',
          600: '#B45309',
          700: '#92400E',
          800: '#78350F',
          900: '#451A03',
        },
        choco: {
          50: '#F9F6F0',
          100: '#EFE6DC',
          200: '#DFC9B5',
          300: '#C7A78E',
          400: '#966E52',
          500: '#4A2E1B',
          600: '#3D2314',
          700: '#2C1810',
          800: '#1F100B',
          900: '#140A07',
        },
        cream: {
          50: '#FFFDF9',
          100: '#FAF6F0',
          200: '#F5EFE6',
          300: '#EAE0D0',
          400: '#DDD0BC',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Outfit', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        '2xs': '0 1px 1px rgba(74, 46, 27, 0.04)',
        'xs': '0 1px 2px rgba(74, 46, 27, 0.06)',
        'soft': '0 1px 2px rgba(74, 46, 27, 0.04), 0 4px 20px -2px rgba(74, 46, 27, 0.08)',
        'soft-lg': '0 2px 4px rgba(74, 46, 27, 0.04), 0 16px 40px -8px rgba(74, 46, 27, 0.16)',
        'card': '0 1px 0 rgba(255, 255, 255, 0.8) inset, 0 1px 2px rgba(74, 46, 27, 0.04), 0 8px 24px -12px rgba(74, 46, 27, 0.12)',
        'card-hover': '0 1px 0 rgba(255, 255, 255, 0.8) inset, 0 2px 4px rgba(74, 46, 27, 0.05), 0 18px 36px -14px rgba(74, 46, 27, 0.22)',
        'waffle': '0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 8px 20px -6px rgba(217, 119, 6, 0.45)',
        'waffle-lg': '0 1px 0 rgba(255, 255, 255, 0.25) inset, 0 14px 30px -8px rgba(217, 119, 6, 0.5)',
        'dock': '0 -12px 32px -12px rgba(20, 10, 7, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 420ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 200ms ease-out both',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
