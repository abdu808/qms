/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.html',
    './public/**/*.js',
  ],
  safelist: [
    // ألوان ديناميكية — مُستخدمة في module-config عبر JS runtime
    {
      pattern: /bg-(slate|sky|violet|teal|emerald|amber|rose|gray|red|green|blue|indigo|brand)-(50|100|200|300|400|500|600|700)/,
    },
    {
      pattern: /text-(slate|sky|violet|teal|emerald|amber|rose|gray|red|green|blue|indigo|brand)-(50|100|200|300|400|500|600|700)/,
    },
    {
      pattern: /border-(slate|sky|violet|teal|emerald|amber|rose|gray|red|green|blue|indigo|brand)-(100|200|300|400|500|600)/,
    },
    // RAG status colors
    'bg-green-50', 'bg-green-100', 'bg-yellow-50', 'bg-yellow-100',
    'bg-red-50', 'bg-red-100', 'bg-orange-50', 'bg-orange-100',
    'text-green-700', 'text-green-600', 'text-yellow-700', 'text-yellow-600',
    'text-red-700', 'text-red-600', 'text-orange-700', 'text-orange-600',
    'border-green-200', 'border-yellow-200', 'border-red-200', 'border-orange-200',
    // ring colors
    'ring-green-200', 'ring-yellow-200', 'ring-red-200', 'ring-blue-200',
    'ring-amber-200', 'ring-emerald-200',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Noto Kufi Arabic', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f9f4',
          100: '#dcf2e3',
          500: '#2e8b57',
          600: '#206d43',
          700: '#1a5a38',
        },
      },
    },
  },
  plugins: [],
};
