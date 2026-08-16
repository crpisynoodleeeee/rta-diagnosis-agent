/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'system-ui',
          'sans-serif'
        ],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', '"SF Mono"', 'Menlo', 'monospace']
      },
      colors: {
        // 克制的中性灰阶（不纯黑不纯白）
        ink: {
          50: '#f8fafb',
          100: '#eef2f4',
          200: '#dce3e7',
          300: '#b9c3ca',
          400: '#8a96a0',
          500: '#5e6973',
          600: '#3f4a54',
          700: '#2a333c',
          800: '#1c232a',
          900: '#10161c'
        },
        // 主色：克制的蓝绿色（青墨）
        teal: {
          50: '#effaf7',
          100: '#d6f1ea',
          200: '#a8e0d3',
          300: '#74c9b8',
          400: '#3eaf9a',
          500: '#1f8a78',
          600: '#166b5e',
          700: '#125448',
          800: '#0f4138',
          900: '#0c342d'
        },
        // 状态色：异常/进行中/成功/待确认
        amber: {
          50: '#fef6e7',
          100: '#fde9c3',
          400: '#f59e0b',
          500: '#d97706',
          600: '#b45309'
        },
        rose: {
          50: '#fef2f2',
          100: '#fee2e2',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626'
        },
        sky: {
          50: '#eef6fb',
          400: '#3b82f6',
          500: '#2563eb',
          600: '#1d4ed8'
        },
        emerald: {
          50: '#ecfdf5',
          400: '#10b981',
          500: '#059669'
        }
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px'
      },
      boxShadow: {
        // 克制阴影：不用大投影，不用多层毛玻璃
        panel: '0 1px 2px 0 rgba(16, 22, 28, 0.04), 0 1px 1px 0 rgba(16, 22, 28, 0.03)',
        'panel-lg': '0 4px 12px -2px rgba(16, 22, 28, 0.08), 0 2px 4px -2px rgba(16, 22, 28, 0.04)',
        drawer: '-8px 0 24px -8px rgba(16, 22, 28, 0.12)'
      },
      fontSize: {
        // B 端节奏：信息密集，但留白克制
        '2xs': ['10px', '14px'],
        xs: ['11px', '16px'],
        sm: ['12px', '18px'],
        base: ['13px', '20px'],
        md: ['14px', '22px'],
        lg: ['16px', '24px'],
        xl: ['18px', '26px'],
        '2xl': ['22px', '30px']
      }
    }
  },
  plugins: []
}
