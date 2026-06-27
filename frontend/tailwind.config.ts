/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chalkboard: '#16302A',
        'chalkboard-light': '#1F4438',
        manila: '#F2E8D5',
        'manila-dark': '#E4D5B5',
        paper: '#FFFDF8',
        mpesa: '#0B7A3D',
        'mpesa-dark': '#08602F',
        stamp: '#B0432C',
        ink: '#211F1B',
        'ink-soft': '#6B665C',
      },
      fontFamily: {
        display: ['"Zilla Slab"', 'serif'],
        body: ['"Work Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
