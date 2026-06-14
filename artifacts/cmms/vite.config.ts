import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { VitePWA } from "vite-plugin-pwa";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    "BASE_PATH environment variable is required but was not provided.",
  );
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-192.png", "pwa-512.png"],
      manifest: {
        name: "Midea Factory CMMS",
        short_name: "Midea CMMS",
        description: "Midea Mobile Factory Computerized Maintenance Management System",
        theme_color: "#0a0a0f",
        background_color: "#0a0a0f",
        display: "standalone",
        orientation: "portrait",
        start_url: basePath || "/",
        scope: basePath || "/",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/,
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, ".."),
            }),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@assets": path.resolve(import.meta.dirname, "..", "..", "attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":   ["react", "react-dom", "wouter"],
          "vendor-query":   ["@tanstack/react-query"],
          "vendor-radix":   [
            "@radix-ui/react-accordion", "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar", "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible", "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu", "@radix-ui/react-label",
            "@radix-ui/react-popover", "@radix-ui/react-progress",
            "@radix-ui/react-radio-group", "@radix-ui/react-scroll-area",
            "@radix-ui/react-select", "@radix-ui/react-separator",
            "@radix-ui/react-slider", "@radix-ui/react-slot",
            "@radix-ui/react-switch", "@radix-ui/react-tabs",
            "@radix-ui/react-toast", "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group", "@radix-ui/react-tooltip",
          ],
          "vendor-charts":  ["recharts"],
          "vendor-motion":  ["framer-motion"],
          "vendor-icons":   ["lucide-react"],
          "vendor-i18n":    ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          "vendor-forms":   ["react-hook-form", "@hookform/resolvers", "zod"],
          "vendor-misc":    ["date-fns", "clsx", "tailwind-merge", "class-variance-authority"],
        },
      },
    },
  },
  server: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
});
