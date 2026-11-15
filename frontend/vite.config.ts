import { defineConfig, type Plugin } from "vite";
import vue from "@vitejs/plugin-vue";
import vueDevTools from "vite-plugin-vue-devtools";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

function antCspStyles(): Plugin {
  const styleElement = "styleNode.innerHTML = css;";
  const noncePatch = [
    [
      styleElement,
      `
        const nonce = document.querySelector('meta[name="fv-style-nonce"]')?.nonce;
        if (nonce && /^[a-f0-9]{32}$/.test(nonce)) styleNode.nonce = nonce;
        ${styleElement}
      `,
    ],
  ] as const;
  const patches = new Map<string, ReadonlyArray<readonly [string, string]>>([
    ["ant-design-vue/es/vc-util/Dom/dynamicCSS.js", noncePatch],
    ["@ant-design/icons-vue/es/dynamicCSS.js", noncePatch],
    // The measuring textarea needs individual CSS properties under CSP.
    [
      "ant-design-vue/es/input/calculateNodeHeight.js",
      [
        [
          "SIZING_STYLE.map(name => `${name}:${style.getPropertyValue(name)}`).join(';')",
          "SIZING_STYLE.map(name => [name, style.getPropertyValue(name)])",
        ],
        [
          "hiddenTextarea.setAttribute('style', `${sizingStyle};${HIDDEN_TEXTAREA_STYLE}`);",
          String.raw`
            for (const [name, value] of sizingStyle) {
              hiddenTextarea.style.setProperty(name, value);
            }
            for (const [, name, value] of HIDDEN_TEXTAREA_STYLE.matchAll(/([a-z-]+):\s*(.*?)\s*!important;/g)) {
              hiddenTextarea.style.setProperty(name, value, 'important');
            }
          `,
        ],
      ],
    ],
  ]);
  const patched = new Set<string>();

  return {
    name: "favorite-ant-csp-styles",
    apply: "build",
    transform(code, id) {
      const dependency = id.split("/node_modules/").pop();
      const replacements = dependency && patches.get(dependency);

      if (!dependency || !replacements) return;
      for (const [original, replacement] of replacements) {
        if (code.split(original).length !== 2) {
          this.error(`Ant CSP style implementation changed: ${dependency}`);
        }

        code = code.replace(original, () => replacement);
      }

      patched.add(dependency);

      return code;
    },
    buildEnd(error) {
      if (!error && patched.size !== patches.size) {
        this.error("An Ant CSP style module was not found in the production build");
      }
    },
  };
}

export default defineConfig(({ command }) => ({
  cacheDir: process.env.FAVOURITE_VITE_CACHE_DIR ?? "node_modules/.vite",
  plugins: [
    vue(),
    antCspStyles(),
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
