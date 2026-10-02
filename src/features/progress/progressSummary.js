import { hasCourseAccess } from "../courses/courseAccess.js";

const MODALITIES = ["ai_lesson", "listening", "live_lesson"];
const ACHIEVEMENT_KEYS = {
  ai_lesson: "completed",
  listening: "listeningCompleted",
  live_lesson: "liveCompleted",
};

const list = (value) => (Array.isArray(value) ? value : []);
const getCourseProgress = (data, courseId) =>
  data?.courseProgress?.[courseId] || {};

function getCompletionIds(data, courseId, modality) {
  const nested = getCourseProgress(data, courseId);
  const root = courseId === "ielts" ? data || {} : nested;
  const key = ACHIEVEMENT_KEYS[modality];
  const ids = [...list(root[key])];
  if (courseId === "ielts" && nested !== root) ids.push(...list(nested[key]));
  return new Set(ids.map(String));
}

function catalogUnits(catalog, modality) {
  if (modality === "ai_lesson")
    return list(catalog?.levels).flatMap((level) => list(level.units));
  if (modality === "listening") return list(catalog?.listening);
  return list(catalog?.liveTopics);
}

function unitsFor(payload, catalog, modality, courseId) {
  const module = payload?.modules?.[modality];
  if (module?.enabled === false) return [];
  const units = Array.isArray(module?.units)
    ? module.units
    : catalogUnits(catalog, modality);
  return units
    .filter((unit) => unit && unit.id != null && unit.published !== false)
    .map((unit) => ({
      ...unit,
      courseId: String(unit.courseId || payload?.course?.id || courseId || ""),
    }));
}

function categoriesFor(payload, catalog, modality, units) {
  const moduleCategories = payload?.modules?.[modality]?.categories;
  let categories = Array.isArray(moduleCategories) ? moduleCategories : [];
  if (!categories.length && modality === "ai_lesson")
    categories = list(catalog?.levels);
  if (!categories.length && modality === "listening") {
    const byId = new Map();
    for (const unit of units) {
      const id = String(unit.categoryId || unit.level || "uncategorized");
      if (!byId.has(id))
        byId.set(id, {
          id,
          name: String(unit.categoryName || unit.level || id),
          label: String(unit.categoryLabel || ""),
          sortOrder: Number(unit.sortOrder) || 0,
        });
    }
    categories = [...byId.values()];
  }
  return categories;
}

const categoryId = (unit) =>
  String(unit.categoryId || unit.level || unit.category_id || "uncategorized");
const normalizedLabel = (value) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ");

function enrolledCourses(courses, fallbackCatalog) {
  const enrolled = list(courses).filter((course) => hasCourseAccess(course));
  if (enrolled.length || !fallbackCatalog) return enrolled;
  return [
    {
      id: "ielts",
      name: "IELTS English Adventure",
      enrolled: true,
      progress: { completed: 0, total: 0 },
    },
  ];
}

function achievementProgressForCourses(data, courses) {
  const achievementIds = Object.fromEntries(
    MODALITIES.map((modality) => [modality, new Set()]),
  );
  for (const course of courses) {
    const courseId = String(course.id || "ielts");
    for (const modality of MODALITIES) {
      for (const id of getCompletionIds(data, courseId, modality))
        achievementIds[modality].add(`${courseId}:${id}`);
    }
  }
  return {
    ...data,
    completed: [...achievementIds.ai_lesson],
    listeningCompleted: [...achievementIds.listening],
    liveCompleted: [...achievementIds.live_lesson],
  };
}

export function aggregateCourseAchievements(data = {}, courses = []) {
  const enrolled = list(courses).filter((course) => hasCourseAccess(course));
  const coursesToCount = enrolled.length ? enrolled : [{ id: "ielts" }];
  return achievementProgressForCourses(data, coursesToCount);
}

export function filterJourneyLevels(levels = [], courseId = "all") {
  if (courseId === "all") return levels;
  return list(levels)
    .map((level) => {
      const units = list(level?.units).filter(
        (unit) => String(unit.courseId) === String(courseId),
      );
      return {
        ...level,
        units,
        courseCount: units.length ? 1 : 0,
        total: units.length,
        completed: units.filter((unit) => unit.completed).length,
      };
    })
    .filter((level) => level.units.length > 0);
}

export function buildCourseProgressSummary({
  courses = [],
  courseCatalogs = {},
  data = {},
  fallbackCatalog = null,
} = {}) {
  const coursesToCount = enrolledCourses(courses, fallbackCatalog);
  const completionSets = Object.fromEntries(
    MODALITIES.map((modality) => [
      modality,
      new Map(
        coursesToCount.map((course) => [
          String(course.id),
          getCompletionIds(data, String(course.id), modality),
        ]),
      ),
    ]),
  );
  const levelGroups = new Map();
  const unitTitles = {};
  const countedUnits = new Set();
  let total = 0;
  let completed = 0;

  for (const course of coursesToCount) {
    const courseId = String(course.id || "ielts");
    const payload = courseCatalogs[courseId] || null;
    const catalog =
      payload?.catalog || (courseId === "ielts" ? fallbackCatalog : null);
    const hasCatalog = Boolean(
      catalog &&
      (Array.isArray(catalog.levels) ||
        Array.isArray(catalog.listening) ||
        Array.isArray(catalog.liveTopics)),
    );
    const hasModuleUnits = MODALITIES.some((modality) =>
      Array.isArray(payload?.modules?.[modality]?.units),
    );
    const exactDataAvailable = hasCatalog || hasModuleUnits;

    if (!exactDataAvailable) {
      const summary = course.progress || {};
      const courseTotal = Math.max(0, Number(summary.total) || 0);
      total += courseTotal;
      completed += Math.min(
        courseTotal,
        Math.max(0, Number(summary.completed) || 0),
      );
      continue;
    }

    const unitsByModality = Object.fromEntries(
      MODALITIES.map((modality) => [
        modality,
        unitsFor(payload, catalog, modality, courseId),
      ]),
    );
    for (const modality of MODALITIES) {
      const doneIds = completionSets[modality].get(courseId) || new Set();
      for (const unit of unitsByModality[modality]) {
        const id = String(unit.id);
        const key = `${courseId}:${modality}:${id}`;
        if (countedUnits.has(key)) continue;
        countedUnits.add(key);
        total += 1;
        if (doneIds.has(id)) completed += 1;
        unitTitles[`${courseId}:${id}`] = unit.title || unit.label || id;
      }
    }

    for (const modality of ["ai_lesson", "listening"]) {
      const units = unitsByModality[modality];
      const categories = categoriesFor(payload, catalog, modality, units);
      for (const category of categories) {
        const id = String(category.id || category.name || "uncategorized");
        const categoryUnits = units.filter((unit) => categoryId(unit) === id);
        if (!categoryUnits.length) continue;
        const name = String(category.name || category.label || id);
        const key = `${modality}:${normalizedLabel(name)}`;
        let group = levelGroups.get(key);
        if (!group) {
          group = {
            key,
            name,
            label: String(category.label || id),
            modality,
            sortOrder: Number(category.sortOrder) || 0,
            color: category.color || course.color || "#7058e8",
            courseIds: new Set(),
            units: [],
            unitKeys: new Set(),
          };
          levelGroups.set(key, group);
        }
        group.courseIds.add(courseId);
        for (const unit of categoryUnits) {
          const unitKey = `${courseId}:${unit.id}`;
          if (group.unitKeys.has(unitKey)) continue;
          group.unitKeys.add(unitKey);
          group.units.push({
            ...unit,
            courseId,
            modality,
            completed: (
              completionSets[modality].get(courseId) || new Set()
            ).has(String(unit.id)),
          });
        }
      }
    }
  }

  const levels = [...levelGroups.values()]
    .map(({ courseIds, unitKeys, ...group }) => ({
      ...group,
      courseCount: courseIds.size,
      total: group.units.length,
      completed: group.units.filter((unit) => unit.completed).length,
    }))
    .sort(
      (a, b) =>
        (a.modality === "ai_lesson" ? 0 : 1) -
          (b.modality === "ai_lesson" ? 0 : 1) ||
        a.sortOrder - b.sortOrder ||
        a.name.localeCompare(b.name),
    );

  return {
    completed,
    total,
    percent: total ? Math.round((completed / total) * 100) : 0,
    courseCount: coursesToCount.length,
    levels,
    unitTitles,
    achievementProgress: achievementProgressForCourses(data, coursesToCount),
  };
}
