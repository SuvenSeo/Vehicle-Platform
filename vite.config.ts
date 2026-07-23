import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router")
          ) {
            return "react-vendor";
          }
          if (id.includes("@tanstack/react-query")) {
            return "query-vendor";
          }
          if (id.includes("@radix-ui") || id.includes("lucide-react")) {
            return "ui-vendor";
          }
          if (id.includes("recharts") || id.includes("d3-")) {
            return "chart-vendor";
          }
          if (id.includes("leaflet") || id.includes("react-leaflet")) {
            return "map-vendor";
          }
          if (id.includes("framer-motion") || id.includes("/motion/")) {
            return "motion-vendor";
          }
          if (
            id.includes("node_modules/jspdf") ||
            id.includes("html2canvas") ||
            id.includes("dompurify")
          ) {
            return "pdf-vendor";
          }
          if (id.includes("node_modules/docx") || id.includes("file-saver")) {
            return "report-vendor";
          }
          if (id.includes("node_modules/zod") || id.includes("@hookform")) {
            return "form-vendor";
          }
        },
      },
    },
  },
});
