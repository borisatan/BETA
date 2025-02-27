/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        rubik : ["Rubik-Regular", "sans-serif"],
        "rubik-bold": ["Rubik-Bold", "sans-serif"],
        "rubik-semibold": ["Rubik-SemiBold", "sans-serif"],
        "rubik-light": ["Rubik-Light", "sans-serif"],
        "rubik-extrabold": ["Rubik-ExtraBold", "sans-serif"],
        "rubik-medium": ["Rubik-Medium", "sans-serif"]
      },
      colors: {
        "background": {100: "#FFFFFF", 200: "#0A0F1F"}, // (White) (Deep Navy Black) 
        "primary": {100: "#1E3A8A", 200: "#1E40AF"}, // (Navy Blue) (Royal Blue)
        "accent": {100: "#F59E0B", 200: "#FACC15"}, // (Golden Amber) (Rich Gold)
        "text": {100: "#1F2937", 200: "#E5E7EB"}, // (Dark Gray) (Light Gray) 
        "error": {100: "#B91C1C", 200: "#EF4444"} // (Deep Red) (Bright Crimson)
      },
    },
    plugins: [],
  }
}