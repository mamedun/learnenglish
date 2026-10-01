const PAGE_PATHS = Object.freeze({
  home: "/home",
  live: "/live",
  progress: "/progress",
  settings: "/settings",
  shop: "/shop",
  admin: "/admin",
});

function decodeSegment(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function appRouteFor(page, { unitId, listeningId } = {}) {
  if (page === "practice") {
    return unitId ? `/lesson/${encodeURIComponent(unitId)}` : "/home";
  }
  if (page === "listening") {
    return listeningId
      ? `/listening/${encodeURIComponent(listeningId)}`
      : "/listening";
  }
  return PAGE_PATHS[page] || "/home";
}

export function parseAppRoute(pathname) {
  const segments = String(pathname || "/")
    .split("/")
    .filter(Boolean);
  if (!segments.length) return { page: "home" };
  if (segments.length > 2) return null;

  const [page, encodedId] = segments;
  if (page === "lesson" && encodedId) {
    const unitId = decodeSegment(encodedId);
    return unitId ? { page: "practice", unitId } : null;
  }
  if (page === "listening") {
    if (!encodedId) return { page: "listening", listeningId: null };
    const listeningId = decodeSegment(encodedId);
    return listeningId ? { page: "listening", listeningId } : null;
  }
  if (encodedId) return null;
  if (
    page === "home" ||
    page === "live" ||
    page === "progress" ||
    page === "settings" ||
    page === "shop" ||
    page === "admin"
  )
    return { page };
  return null;
}
