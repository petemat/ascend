import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Build for subpath hosting (e.g. /ascend/) via relative asset URLs.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
