/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
     colors: {
  primary: {
    purple: '#7C3AED',
    teal: '#14B8A6',     // ✅ Changed from blue
  },
  accent: {
    green: '#10B981',
    yellow: '#F59E0B',
    red: '#EF4444',
    cyan: '#06B6D4',
    teal: '#14B8A6',     // ✅ Added teal
  },
  department: {
    cse: '#14B8A6',      // ✅ Changed to teal
    ece: '#F97316',
    mech: '#6B7280',
    civil: '#92400E',
    eee: '#EAB308',
    aiml: '#A855F7',
    ise: '#EC4899',
    ds: '#8B5CF6',
    ra: '#14B8A6',
  },
  background: {
    cream: '#FAF8F3',    // ✅ New cream background
    warm: '#FFF8F0',     // ✅ New warm background
  }
},
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}