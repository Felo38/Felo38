/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Approximated from the On the Run logo; replace with brand values if provided.
        otr: {
          yellow: '#F5D04A',
          blue: '#1F5FAD',
          red: '#D8202A',
        },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Tahoma', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
