import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0a0e17',
          elevated: '#111722',
          surface: '#161d2b',
          hover: '#1c2433'
        },
        border: {
          DEFAULT: '#212a3b',
          strong: '#2d3852'
        },
        text: {
          DEFAULT: '#e6edf7',
          muted: '#8b96ad',
          dim: '#5a6478'
        },
        accent: {
          green: '#00d97e',
          'green-dim': '#00a862',
          red: '#ff4d4f',
          'red-dim': '#cc3d3f',
          amber: '#ffb020',
          blue: '#3b82f6',
          purple: '#a855f7',
          cyan: '#06b6d4'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: []
};

export default config;
