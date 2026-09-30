import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8787";
  const configuredPrefix = env.VITE_API_PROXY_PATH_PREFIX;
  const proxyPrefix = (
    configuredPrefix === undefined ? "/learnenglish" : configuredPrefix
  ).replace(/\/$/, "");
  return {
    base: "/learnenglish/",
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/learnenglish/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          // Browser -> Vite is same-origin. Do not forward the preview host as
          // a cross-origin Origin header to the internal PHP dev server.
          configure: (proxy) =>
            proxy.on("proxyReq", (request) => request.removeHeader("origin")),
          rewrite: (path) =>
            path.replace(/^\/learnenglish\/api/, `${proxyPrefix}/api`),
        },
      },
    },
    preview: { host: "0.0.0.0", allowedHosts: true },
  };
});
