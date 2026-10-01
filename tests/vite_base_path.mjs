import assert from "node:assert/strict";
import viteConfig from "../vite.config.js";

function configFor(env) {
  for (const key of ["VITE_BASE_PATH", "VITE_API_PROXY_PATH_PREFIX"])
    delete process.env[key];
  Object.assign(process.env, env);
  return viteConfig({ mode: "arena-path-test" });
}

const defaultConfig = configFor({});
assert.equal(defaultConfig.base, "/learnenglish/");
assert.deepEqual(Object.keys(defaultConfig.server.proxy), [
  "/learnenglish/api",
]);
assert.equal(
  defaultConfig.server.proxy["/learnenglish/api"].rewrite(
    "/learnenglish/api/health",
  ),
  "/learnenglish/api/health",
);

const subfolderConfig = configFor({
  VITE_BASE_PATH: "/speakup/",
  VITE_API_PROXY_PATH_PREFIX: "/php/",
});
assert.equal(subfolderConfig.base, "/speakup/");
assert.equal(
  subfolderConfig.server.proxy["/speakup/api"].rewrite(
    "/speakup/api/auth/refresh",
  ),
  "/php/api/auth/refresh",
);

const rootConfig = configFor({
  VITE_BASE_PATH: "/",
  VITE_API_PROXY_PATH_PREFIX: "",
});
assert.equal(rootConfig.base, "/");
assert.deepEqual(Object.keys(rootConfig.server.proxy), ["/api"]);
assert.equal(
  rootConfig.server.proxy["/api"].rewrite("/api/health"),
  "/api/health",
);

console.log("Vite base path and PHP proxy tests passed");
