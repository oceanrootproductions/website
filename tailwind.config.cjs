/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'deep-ocean': '#0B3B5A',
        'seafoam': '#EAF7FB',
        'coral-accent': '#FF6B6B',
        'ink': '#0B0F12',
        'abyss': '#05090D',
        'aqua': '#7EE7FF',
      },
      fontFamily: {
        heading: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui'],
        body: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0, 0, 0, 0.25)',
        glow: '0 0 28px rgba(126, 231, 255, 0.28)',
      },
    },
  },
  plugins: [],
}
