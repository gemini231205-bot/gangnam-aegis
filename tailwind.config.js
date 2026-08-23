/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        base: {
          900: '#05070d',
          800: '#0a0e1a',
          700: '#0d1320',
          600: '#121a2e',
          500: '#1a2540',
        },
        cyber: {
          cyan: '#22d3ee',
          blue: '#3b82f6',
          emerald: '#10b981',
          amber: '#f59e0b',
          red: '#ef4444',
          rose: '#f43f5e',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 24px -4px rgba(34, 211, 238, 0.45)',
        'glow-red': '0 0 24px -4px rgba(239, 68, 68, 0.5)',
        'glow-emerald': '0 0 24px -4px rgba(16, 185, 129, 0.45)',
      },
    },
  },
  plugins: [],
};
