const PAID_STATUSES = new Set([
  "paid",
  "approved",
  "purchased",
  "complete",
  "completed",
  "active",
]);

function hasPaidStatus(value) {
  if (value === true) return true;
  if (!value) return false;
  if (typeof value === "string") return PAID_STATUSES.has(value.toLowerCase());
  if (typeof value !== "object") return false;
  return (
    value.paid === true ||
    value.approved === true ||
    PAID_STATUSES.has(String(value.status || "").toLowerCase())
  );
}

export function hasCourseAccess(course = {}) {
  return Boolean(
    course.enrolled === true ||
    course.owned === true ||
    course.hasAccess === true ||
    course.canAccess === true ||
    (typeof course.enrollmentSource === "string" &&
      course.enrollmentSource.length > 0) ||
    hasPaidStatus(course.purchased) ||
    hasPaidStatus(course.purchaseStatus) ||
    hasPaidStatus(course.purchase) ||
    hasPaidStatus(course.payment),
  );
}

export function partitionCourses(courses = []) {
  const unique = new Map();
  for (const course of Array.isArray(courses) ? courses : []) {
    if (!course || course.id == null || String(course.id).trim() === "")
      continue;
    const id = String(course.id);
    const previous = unique.get(id);
    if (!previous || (!hasCourseAccess(previous) && hasCourseAccess(course)))
      unique.set(id, course);
  }
  const catalog = [...unique.values()];
  return {
    enrolled: catalog.filter((course) => hasCourseAccess(course)),
    available: catalog.filter(
      (course) => !hasCourseAccess(course) && course.status === "published",
    ),
  };
}
