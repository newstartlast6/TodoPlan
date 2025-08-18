import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import electron from "vite-plugin-electron";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    (electron as any)([
      {
        // Main process
        entry: path.resolve(import.meta.dirname, "electron", "main.ts"),
        vite: {
          resolve: {
            alias: {
              "@": path.resolve(import.meta.dirname, "client", "src"),
              "@shared": path.resolve(import.meta.dirname, "shared"),
            },
          },
          build: {
            outDir: path.resolve(import.meta.dirname, "dist-electron"),
            rollupOptions: {
              external: [
                // Optional native driver requested by "pg"; externalize so require() remains inside try/catch
                'pg-native',
                'pg',
              ],
            },
          },
        },
      },
      {
        // Preload scripts
        entry: {
          preload: path.resolve(import.meta.dirname, "electron", "preload.ts"),
        },
        vite: {
          resolve: {
            alias: {
              "@": path.resolve(import.meta.dirname, "client", "src"),
              "@shared": path.resolve(import.meta.dirname, "shared"),
            },
          },
          build: {
            outDir: path.resolve(import.meta.dirname, "dist-electron"),
            ssr: true,
            rollupOptions: {
              external: [
                'electron',
                'path',
                'url',
                'fs',
              ],
              output: {
                format: "cjs",
                entryFileNames: () => `preload.cjs`,
                exports: 'none', // Changed from 'auto' to 'none'
              },
            },
            target: 'node18',
            minify: false,
            sourcemap: false,
            commonjsOptions: {
              transformMixedEsModules: true,
            },
            // Force CommonJS output
            lib: {
              entry: path.resolve(import.meta.dirname, "electron", "preload.ts"),
              formats: ['cjs'],
              fileName: () => 'preload.cjs',
            },
          },
        },
      },
    ]),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    // Ensure front-end API calls hit the Electron-embedded Express server during dev
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.ELECTRON_API_PORT || '5002'}`,
        changeOrigin: true,
        secure: false,
      },
    },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
