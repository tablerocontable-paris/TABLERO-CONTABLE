import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          framework: ["react-dom/client", "react", "scheduler"],
          charts: ["recharts"],
          icons: ["lucide-react"],
          validation: ["zod"],
        },
      },
    },
  },
});
