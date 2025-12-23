import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0fdf4',
          100: '#dcfce7',
          400: '#34d399',   // brukt av focus:ring-primary-400
          500: '#22c55e',   // brukt av focus:border-primary-500
          600: '#16a34a',
          700: '#15803d',
        },
      },
    },
  },
  plugins: [],
}

export default config
