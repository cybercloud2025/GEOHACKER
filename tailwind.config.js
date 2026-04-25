/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#121212',
        surfaceHighlight: '#1E1E1E',
        primary: '#00f7ff', // Cyan Neon
        secondary: '#ff00e6', // Magenta Neon
        accent: '#7000ff', // Purple
        success: '#00ff9d',
        warning: '#ffd000',
        error: '#ff2a2a',
        text: '#eaeaea',
        muted: '#888888'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'], // For PIN and codes
      },
      boxShadow: {
        'glow-primary': '0 0 20px rgba(0, 247, 255, 0.5)',
        'glow-secondary': '0 0 20px rgba(255, 0, 230, 0.5)',
      }
    },
  },
  plugins: [],
  darkMode: 'class',
}
