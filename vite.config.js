import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function normalizeBasePath(value) {
  const path = String(value ?? "/learnenglish").trim();
  if (!path || path === "/") return "/";
  return `/${path.replace(/^\/+|\/+$/g, "")}/`;
}

function normalizePathPrefix(value) {
  const path = String(value ?? "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  return path ? `/${path}` : "";
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const base = normalizeBasePath(env.VITE_BASE_PATH);
  const basePath = base === "/" ? "" : base.slice(0, -1);
  const browserApiPath = `${basePath}/api`;
  const proxyTarget = env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8787";
  const proxyPrefix = normalizePathPrefix(
    env.VITE_API_PROXY_PATH_PREFIX === undefined
      ? basePath
      : env.VITE_API_PROXY_PATH_PREFIX,
  );

  return {
    base,
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        [browserApiPath]: {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          // Browser -> Vite is same-origin. Do not forward the preview host as
          // a cross-origin Origin header to the internal PHP dev server.
          configure: (proxy) =>
            proxy.on("proxyReq", (request) => request.removeHeader("origin")),
          rewrite: (path) =>
            `${proxyPrefix}/api${path.slice(browserApiPath.length)}`,
        },
      },
    },
    preview: { host: "0.0.0.0", allowedHosts: true },
  };
});
