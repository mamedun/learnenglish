const configured = import.meta.env.VITE_API_BASE_URL?.trim();
const base = configured
  ? configured.replace(/\/$/, "")
  : `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
function apiUrl(path) {
  const suffix = path.replace(/^\/+/, "");
  return `${base}/${suffix}`;
}
async function apiFetch(path, init = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...init,
  });
  if (response.status === 423 && typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent("speakup:locked"));
  return response;
}
async function apiJson(path, init = {}) {
  const response = await apiFetch(path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Request gagal (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return body;
}
export { apiFetch, apiJson, apiUrl };
