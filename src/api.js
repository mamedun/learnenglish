import { useAuthStore } from "./store/authStore";

const configured = import.meta.env.VITE_API_BASE_URL?.trim();
const base = configured
  ? configured.replace(/\/$/, "")
  : `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;

function apiUrl(path) {
  return `${base}/${path.replace(/^\/+/, "")}`;
}

function errorFromResponse(response, body) {
  const error = new Error(body.error || `Request gagal (${response.status})`);
  error.status = response.status;
  error.code = body.code;
  error.diagnostics = body.diagnostics;
  return error;
}

function rawFetch(path, init = {}, accessToken) {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(apiUrl(path), { ...init, credentials: "include", headers });
}

let refreshPromise;
async function refreshSession({ retryOnConflict = false } = {}) {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      let response = await rawFetch("auth/refresh", { method: "POST" });
      // If another browser tab rotated the shared HttpOnly cookie at the same
      // moment, let that Set-Cookie settle and retry once with the NEW cookie.
      if (response.status === 401 && retryOnConflict) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        response = await rawFetch("auth/refresh", { method: "POST" });
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw errorFromResponse(response, body);
      useAuthStore.getState().setAccessToken(body.access_token);
      useAuthStore.getState().setUser(body.user);
      return body;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

const publicRoutes = new Set([
  "health",
  "login",
  "register",
  "logout",
  "auth/refresh",
]);
async function apiFetch(path, init = {}) {
  const token = useAuthStore.getState().accessToken;
  let response = await rawFetch(path, init, token);
  if (response.status === 401 && token && !publicRoutes.has(path)) {
    try {
      await refreshSession({ retryOnConflict: true }); // Shared by simultaneous requests.
      response = await rawFetch(
        path,
        init,
        useAuthStore.getState().accessToken,
      );
    } catch (error) {
      if (error.status !== 401 && error.status !== 423) throw error;
      if (error.status === 401) {
        useAuthStore.getState().clearAuth();
        window.dispatchEvent(new CustomEvent("speakup:session-expired"));
      } else {
        window.dispatchEvent(new CustomEvent("speakup:locked"));
      }
      return response;
    }
  }
  if (response.status === 423) {
    window.dispatchEvent(new CustomEvent("speakup:locked"));
  }
  return response;
}

async function apiJson(path, init = {}) {
  const response = await apiFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw errorFromResponse(response, body);
  return body;
}

export { apiFetch, apiJson, apiUrl, refreshSession };
