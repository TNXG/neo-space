import vue from "@vitejs/plugin-vue";

import vueJsx from "@vitejs/plugin-vue-jsx";
import UnoCSS from "unocss/vite";

import { defineConfig } from "vite";
import { checker } from "vite-plugin-checker";
import VueInspector from "vite-plugin-vue-inspector";

// dns.setDefaultResultOrder('verbatim')
export default ({ mode }) => {
  const isDev = mode === "development";

  return defineConfig({
    plugins: [
      // mkcert(),
      UnoCSS(),
      vue({}),
      vueJsx(),

      ...(isDev
        ? [
            VueInspector({
              toggleButtonVisibility: "always",
              launchEditor: "cursor",
            }),
          ]
        : []),

      checker({
        enableBuild: true,
      }),
      // nodePolyfills({
      //   // To exclude specific polyfills, add them to this list.
      //   exclude: [
      //     'fs', // Excludes the polyfill for `fs` and `node:fs`.
      //   ],
      //   // Whether to polyfill `node:` protocol imports.
      //   protocolImports: true,
      // }),
    ],

    resolve: {
      tsconfigPaths: true,
      alias: {
        "path": "path-browserify",
        "os": "os-browserify",
        "node-fetch": "isomorphic-fetch",
        "buffer": "buffer",
      },
    },

    build: {
      chunkSizeWarningLimit: 2500,
      target: "esnext",

      // sourcemap: true,
      rollupOptions: {
        output: {
          chunkFileNames: `js/[name]-[hash].js`,
          entryFileNames: `js/[name]-[hash].js`,
        },
      },
    },
    optimizeDeps: {
      exclude: ["@huacnlee/autocorrect", "@dqbd/tiktoken"],
    },

    define: {
      __DEV__: isDev,
    },
    base: "/proxy/",

    server: {
      // https: true,
      port: 9528,
      strictPort: true,
    },
    oxc: {
      jsx: {
        runtime: "automatic",
        importSource: "vue",
      },
    },
    test: {
      environment: "happy-dom",
    },
  });
};
