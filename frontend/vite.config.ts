import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ command }) => ({
  cacheDir: process.env.FAVOURITE_VITE_CACHE_DIR ?? "node_modules/.vite",
  plugins: [
    vue(),
    ...(command === "serve"
      ? [vueDevTools({ launchEditor: process.env.LAUNCH_EDITOR })]
      : []),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "favicon.ico",
        "favicon.svg",
        "apple-touch-icon.png",
        "pwa-192.png",
        "pwa-512.png",
      ],
      manifest: {
        name: "Favorite — медиатека и журнал просмотров",
        short_name: "Favorite",
        description: "Личная медиатека, коллекция, списки и журнал просмотров.",
        theme_color: "#ff0032",
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        lang: "ru",
        icons: [
          {
            src: "pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Админка загружается при открытии, без предварительной загрузки для всех пользователей.
        globIgnores: [
          "**/AdminPage-*.{js,css}",
          "**/pdfmake.min-*.js",
          "**/collectionPdf-*.js",
        ],
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /^\/assets\/(?:pdfmake\.min|collectionPdf|fv-sans-(?:regular|bold))-[^/]+\.(?:js|woff)$/.test(
                url.pathname
              ),
            handler: "CacheFirst",
            options: {
              cacheName: "collection-pdf-assets",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 8, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              /^\/assets\/AdminPage-[^/]+\.(?:js|css)$/.test(url.pathname),
            handler: "CacheFirst",
            options: {
              cacheName: "admin-assets",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 8, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 8080,
  },
}));
