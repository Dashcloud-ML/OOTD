import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The proxy means the frontend can call fetch("/api/style") in development
// and Vite forwards it to the backend — no CORS pain locally.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
});
