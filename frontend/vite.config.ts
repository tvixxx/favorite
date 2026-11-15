import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

function antStyleNonce(): Plugin {
  const injectors = new Set([
    "ant-design-vue/es/vc-util/Dom/dynamicCSS.js",
    "@ant-design/icons-vue/es/dynamicCSS.js",
  ]);
  const createStyle = "styleNode.innerHTML = css;";
  const patched = new Set<string>();

  return {
    name: "favorite-ant-style-nonce",
    apply: "build",
    transform(code, id) {
      const dependency = id.split("/node_modules/").pop();

      if (!dependency || !injectors.has(dependency)) return;
      if (code.split(createStyle).length !== 2) {
        this.error(`Ant style injector changed: ${dependency}`);
      }

      patched.add(dependency);

      // Ant component and animation styles do not all receive ConfigProvider.csp.
      return code.replace(
        createStyle,
        `
        const nonce = document.querySelector('meta[name="fv-style-nonce"]')?.nonce;
        if (nonce && /^[a-f0-9]{32}$/.test(nonce)) styleNode.nonce = nonce;
        ${createStyle}
      `
      );
    },
    buildEnd(error) {
      if (!error && patched.size !== injectors.size) {
        this.error("An Ant style injector was not found in the production build");
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  cacheDir: process.env.FAVOURITE_VITE_CACHE_DIR ?? "node_modules/.vite",
  plugins: [
    vue(),
    antStyleNonce(),
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
