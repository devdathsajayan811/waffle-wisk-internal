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
        sans: ['Inter', 'Outfit', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(74, 46, 27, 0.08)',
        'soft-lg': '0 10px 30px -5px rgba(74, 46, 27, 0.12)',
        'waffle': '0 8px 25px -3px rgba(232, 157, 37, 0.25)',
      }
    },
  },
  plugins: [],
}
