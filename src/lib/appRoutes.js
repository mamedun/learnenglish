const PAGE_PATHS = Object.freeze({
  home: "/home",
  courses: "/courses",
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

const encode = (value) => encodeURIComponent(String(value));

export function appRouteFor(
  page,
  { unitId, listeningId, courseId, topicId } = {},
) {
  if (page === "course-detail")
    return courseId ? `/course/${encode(courseId)}` : "/courses";
  if (page === "practice") {
    if (!unitId) return "/home";
    return courseId
      ? `/course/${encode(courseId)}/ai/${encode(unitId)}`
      : `/lesson/${encode(unitId)}`;
  }
  if (page === "listening") {
    if (courseId)
      return listeningId
        ? `/course/${encode(courseId)}/listening/${encode(listeningId)}`
        : `/course/${encode(courseId)}/listening`;
    return listeningId ? `/listening/${encode(listeningId)}` : "/listening";
  }
  if (page === "live") {
    if (courseId)
      return topicId
        ? `/course/${encode(courseId)}/live/${encode(topicId)}`
        : `/course/${encode(courseId)}/live`;
    return "/live";
  }
  return PAGE_PATHS[page] || "/home";
}

export function parseAppRoute(pathname) {
  const segments = String(pathname || "/")
    .split("/")
    .filter(Boolean);
  if (!segments.length) return { page: "home" };

  if (segments[0] === "course") {
    if (segments.length < 2 || segments.length > 4) return null;
    const courseId = decodeSegment(segments[1]);
    if (!courseId) return null;
    if (segments.length === 2) return { page: "course-detail", courseId };
    const mode = segments[2];
    if (mode === "ai" && segments.length === 4) {
      const unitId = decodeSegment(segments[3]);
      return unitId ? { page: "practice", courseId, unitId } : null;
    }
    if (mode === "listening" && segments.length <= 4) {
      const listeningId = segments[3] ? decodeSegment(segments[3]) : null;
      if (segments[3] && !listeningId) return null;
      return { page: "listening", courseId, listeningId };
    }
    if (mode === "live" && segments.length <= 4) {
      const topicId = segments[3] ? decodeSegment(segments[3]) : null;
      if (segments[3] && !topicId) return null;
      return { page: "live", courseId, topicId };
    }
    return null;
  }

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
    page === "courses" ||
    page === "live" ||
    page === "progress" ||
    page === "settings" ||
    page === "shop" ||
    page === "admin"
  )
    return { page };
  return null;
}
