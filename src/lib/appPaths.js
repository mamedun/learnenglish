const configuredBase = import.meta.env.BASE_URL || "/";

export const APP_BASE_PATH = configuredBase.replace(/\/+$/, "");

export function appPath(path = "") {
  const suffix = String(path || "").replace(/^\/+/, "");
  if (!suffix) return APP_BASE_PATH ? `${APP_BASE_PATH}/` : "/";
  return `${APP_BASE_PATH}/${suffix}`;
}

export const appAsset = appPath;
