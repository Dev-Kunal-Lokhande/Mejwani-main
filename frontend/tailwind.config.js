/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],

    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },

            boxShadow: {
                premium: '0 20px 60px rgba(0,0,0,0.08)',
                orangeGlow: '0 20px 50px rgba(255,107,0,0.15)',
                blueGlow: '0 20px 50px rgba(59,130,246,0.15)',
            },
        },
    },

    plugins: [],
}