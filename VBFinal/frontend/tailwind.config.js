/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#1D4ED8',
        neutral: '#374151',
        success: '#10B981',
        error: '#EF4444',
        warning: '#F59E0B',
      }
    },
  },
  plugins: [],
}
