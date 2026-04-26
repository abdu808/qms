/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/**/*.html',
    './public/**/*.js',
  ],
  safelist: [
    // ── ألوان خلفية ديناميكية (module-config) ─────────────────────────────
    // variants: hover/focus/group-hover/active/disabled مضافة لأن Docker (Alpine)
    // لا يُشغّل content scanner بشكل صحيح → يُولَّد من safelist فقط
    {
      pattern: /^bg-(slate|sky|violet|teal|emerald|amber|rose|gray|red|green|blue|indigo|orange|yellow|purple|brand)-(50|100|200|300|400|500|600|700|800|900)$/,
      variants: ['hover', 'focus', 'group-hover', 'active', 'disabled'],
    },
    {
      pattern: /^text-(slate|sky|violet|teal|emerald|amber|rose|gray|red|green|blue|indigo|orange|yellow|purple|brand)-(50|100|200|300|400|500|600|700|800|900)$/,
      variants: ['hover', 'focus', 'group-hover', 'active', 'disabled'],
    },
    {
      pattern: /^border-(slate|sky|violet|teal|emerald|amber|rose|gray|red|green|blue|indigo|orange|yellow|purple|brand)-(50|100|200|300|400|500|600|700)$/,
      variants: ['hover', 'focus'],
    },
    // ── Gradient من/إلى (sidebar + login background) ────────────────────────
    {
      pattern: /^from-(gray|slate|blue|violet|indigo|teal|brand|white|black|amber)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    {
      pattern: /^to-(gray|slate|blue|violet|indigo|teal|brand|white|black|amber)-(50|100|200|300|400|500|600|700|800|900)$/,
    },
    {
      pattern: /^via-(gray|slate|blue|brand)-(50|100|200|300|400|500|600|700)$/,
    },
    // ── Opacity modifier — مستخدمة كـ bg-black/40, ring-black/5 ───────────
    {
      pattern: /^bg-(black|white)\/(5|10|20|25|30|40|50|60|70|75|80|90)$/,
    },
    {
      pattern: /^ring-(black|white)\/(5|10|20|30)$/,
    },
    {
      pattern: /^(text|border)-(white|black)\/(40|60|70|80|90)$/,
    },
    // ── Hover + opacity modifier (للعناصر الديناميكية) ───────────────────
    'hover:bg-amber-100/60','hover:bg-white/30',
    // ── Backdrop + blur ────────────────────────────────────────────────────
    'backdrop-blur-sm', 'backdrop-blur', 'backdrop-blur-md',
    // ── Z-index عالٍ (modals) ────────────────────────────────────────────
    'z-[200]', 'z-[250]', 'z-[400]', 'z-[500]', 'z-[600]',
    // ── RAG + status colors ───────────────────────────────────────────────
    'bg-green-50',  'bg-green-100',  'bg-yellow-50',  'bg-yellow-100',
    'bg-red-50',    'bg-red-100',    'bg-orange-50',  'bg-orange-100',
    'bg-amber-50',  'bg-amber-100',  'bg-blue-50',    'bg-blue-100',
    'text-green-700','text-green-600','text-yellow-700','text-yellow-600',
    'text-red-700',  'text-red-600',  'text-orange-700','text-orange-600',
    'text-amber-700','text-amber-600','text-blue-700',  'text-blue-600',
    'border-green-200','border-yellow-200','border-red-200','border-orange-200',
    'border-amber-200','border-blue-200',
    // ── Ring + focus (used in form inputs) ───────────────────────────────
    {
      pattern: /^ring-(brand|blue|amber|red|green|indigo|violet)-(200|300|400|500)$/,
      variants: ['focus', 'hover'],
    },
    {
      pattern: /^border-(brand|blue|amber|red|green|indigo|violet)-(300|400|500)$/,
      variants: ['focus', 'hover'],
    },
    // ── Ring colors ───────────────────────────────────────────────────────
    'ring-green-200','ring-yellow-200','ring-red-200','ring-blue-200',
    'ring-amber-200','ring-emerald-200','ring-brand-300',
    // ── Gradient directions ────────────────────────────────────────────────
    'bg-gradient-to-l','bg-gradient-to-r','bg-gradient-to-bl',
    'bg-gradient-to-br','bg-gradient-to-t','bg-gradient-to-b',
    // ── Typography scale (قد تُبنى ديناميكياً) ─────────────────────────────
    'text-xs','text-sm','text-base','text-lg','text-xl',
    'text-2xl','text-3xl','text-4xl',
    'font-normal','font-medium','font-semibold','font-bold',
    // ── Spacing للـ modals ─────────────────────────────────────────────────
    'p-4','p-6','p-8','px-4','px-6','py-2','py-3','py-4',
    'gap-2','gap-3','gap-4','space-y-2','space-y-3','space-y-4',
    // ── Translate للـ sidebar mobile ──────────────────────────────────────
    'translate-x-0','translate-x-full','-translate-x-full',
    'md:translate-x-0',
    // ── Ring opacity ─────────────────────────────────────────────────────
    'ring-1','ring-2','ring-4',
    // ── Hover utility variants (content scanner غير موثوق في Docker/Alpine) ──
    'hover:brightness-95','hover:brightness-90','hover:underline','hover:opacity-100',
    'hover:scale-105','hover:scale-125','hover:shadow-md','hover:shadow-lg',
    // ── Focus + Disabled ─────────────────────────────────────────────────
    'focus:outline-none','focus:ring-2','focus:ring-1','focus:ring-4',
    'disabled:opacity-50','disabled:opacity-60','disabled:cursor-not-allowed',
    // ── Group hover ───────────────────────────────────────────────────────
    'group-hover/item:opacity-100','group-hover:opacity-100','group-hover:block',
    'opacity-0','opacity-100',
    // ── Responsive ───────────────────────────────────────────────────────
    'md:hidden','md:block','md:flex','md:grid','md:grid-cols-2','md:grid-cols-3',
    'md:w-96','sm:grid-cols-2',
    // ── White/gray text variants for dark backgrounds ─────────────────────
    'hover:text-white','hover:text-gray-600','hover:text-gray-800',
    'text-white/80','text-white/90','text-amber-400',
    'hover:text-amber-400','hover:text-amber-500',
    'hover:bg-gray-50','hover:bg-gray-100','hover:bg-red-50','hover:bg-indigo-50',
    'hover:border-indigo-200','hover:border-indigo-400',
    'hover:text-indigo-600','hover:text-brand-600',
    // ── Transition ────────────────────────────────────────────────────────
    'transition','transition-all','transition-colors','transition-opacity','transition-transform',
    'duration-200','duration-300',
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
          200: '#b9e5cc',
          300: '#8dd4aa',
          400: '#5cbe84',
          500: '#2e8b57',
          600: '#206d43',
          700: '#1a5a38',
          800: '#144830',
          900: '#0e3522',
        },
      },
    },
  },
  plugins: [],
};
