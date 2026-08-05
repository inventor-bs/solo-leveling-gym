import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#080810",
        "shadow-dark": "#0D0D1A",
        "shadow-mid": "#1A1A2E",
        "shadow-light": "#16213E",
        "system-blue": "#00D4FF",
        "system-blue-dim": "#0099BB",
        "monarch-purple": "#7B2FBE",
        "monarch-light": "#9B4FDE",
        "gold": "#FFD700",
        "gold-dim": "#C9A800",
        "danger": "#FF3366",
        "warning": "#FF9900",
        "success": "#00FF88",
        "rank-e": "#9CA3AF",
        "rank-d": "#4ADE80",
        "rank-c": "#60A5FA",
        "rank-b": "#A78BFA",
        "rank-a": "#F59E0B",
        "rank-s": "#FF6B35",
        "rank-national": "#FF3366",
      },
      fontFamily: {
        cinzel: ["var(--font-cinzel)", "serif"],
        inter: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      boxShadow: {
        "system": "0 0 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.1), inset 0 0 20px rgba(0, 212, 255, 0.05)",
        "system-hover": "0 0 30px rgba(0, 212, 255, 0.5), 0 0 60px rgba(0, 212, 255, 0.2)",
        "purple": "0 0 20px rgba(123, 47, 190, 0.4), 0 0 40px rgba(123, 47, 190, 0.2)",
        "gold": "0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.1)",
        "danger": "0 0 20px rgba(255, 51, 102, 0.4), 0 0 40px rgba(255, 51, 102, 0.2)",
      },
      backgroundImage: {
        "void-gradient": "radial-gradient(ellipse at top, #0D0D1A 0%, #080810 100%)",
        "purple-gradient": "linear-gradient(135deg, #7B2FBE 0%, #4A1080 100%)",
        "system-gradient": "linear-gradient(180deg, rgba(0,212,255,0.1) 0%, transparent 100%)",
        "scan-lines": "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,255,0.015) 2px, rgba(0,212,255,0.015) 4px)",
      },
      animation: {
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "flicker": "flicker 0.15s infinite",
        "scan": "scan 8s linear infinite",
        "particle": "particle 4s ease-in-out infinite",
        "rank-shine": "rank-shine 3s ease-in-out infinite",
        "border-flow": "border-flow 4s linear infinite",
        "count-up": "count-up 0.5s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
      },
      keyframes: {
        "glow-pulse": {
          "0%, 100%": { opacity: "1", filter: "drop-shadow(0 0 8px rgba(0, 212, 255, 0.6))" },
          "50%": { opacity: "0.7", filter: "drop-shadow(0 0 16px rgba(0, 212, 255, 0.9))" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "flicker": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        "scan": {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "0 100%" },
        },
        "particle": {
          "0%": { transform: "translateY(0) scale(1)", opacity: "0.8" },
          "50%": { transform: "translateY(-20px) scale(1.2)", opacity: "0.4" },
          "100%": { transform: "translateY(-40px) scale(0)", opacity: "0" },
        },
        "rank-shine": {
          "0%, 100%": { backgroundPosition: "200% center" },
          "50%": { backgroundPosition: "-200% center" },
        },
        "border-flow": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        "count-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(20px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
