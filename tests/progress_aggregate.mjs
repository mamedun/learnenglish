import assert from "node:assert/strict";
import {
  aggregateCourseAchievements,
  buildCourseProgressSummary,
} from "../src/features/progress/progressSummary.js";

const courses = [
  { id: "ielts", name: "IELTS", enrolled: true },
  { id: "remote", name: "Remote English", enrolled: true },
  { id: "tour", name: "Tour Guide", enrolled: false },
];
const unit = (id, categoryId, title) => ({
  id,
  categoryId,
  title,
  published: true,
});
const module = (category, units) => ({
  enabled: true,
  categories: [{ id: category, name: "A1", label: "Beginner", sortOrder: 0 }],
  units,
});
const courseCatalogs = {
  ielts: {
    course: { id: "ielts", name: "IELTS" },
    modules: {
      ai_lesson: module("a1-speaking", [
        unit("ielts-speak", "a1-speaking", "IELTS speaking"),
      ]),
      listening: module("a1-listening", [
        unit("ielts-listen", "a1-listening", "IELTS listening"),
      ]),
      live_lesson: {
        enabled: true,
        categories: [],
        units: [unit("ielts-live", "role-play", "IELTS live")],
      },
    },
  },
  remote: {
    course: { id: "remote", name: "Remote English" },
    modules: {
      ai_lesson: module("remote-speaking", [
        unit("remote-speak", "remote-speaking", "Remote speaking"),
      ]),
      listening: module("remote-listening", [
        unit("remote-listen", "remote-listening", "Remote listening"),
      ]),
      live_lesson: {
        enabled: true,
        categories: [],
        units: [unit("remote-live", "hidden", "Remote live")],
      },
    },
  },
};
const data = {
  xp: 125,
  streak: 4,
  completed: ["ielts-speak"],
  listeningCompleted: ["ielts-listen"],
  courseProgress: {
    ielts: { liveCompleted: ["ielts-live"] },
    remote: {
      completed: ["remote-speak"],
      listeningCompleted: [],
      liveCompleted: ["remote-live"],
    },
  },
};

const summary = buildCourseProgressSummary({ courses, courseCatalogs, data });
assert.equal(
  summary.total,
  6,
  "totals include all modalities for enrolled courses only",
);
assert.equal(summary.completed, 5);
assert.equal(summary.percent, 83);
assert.equal(summary.courseCount, 2);
assert.deepEqual(
  summary.levels.map(({ modality, total, completed, courseCount }) => ({
    modality,
    total,
    completed,
    courseCount,
  })),
  [
    { modality: "ai_lesson", total: 2, completed: 2, courseCount: 2 },
    { modality: "listening", total: 2, completed: 1, courseCount: 2 },
  ],
);
assert.equal(summary.achievementProgress.completed.length, 2);
assert.equal(summary.achievementProgress.listeningCompleted.length, 1);
assert.equal(summary.achievementProgress.liveCompleted.length, 2);
assert.equal(summary.unitTitles["remote:remote-live"], "Remote live");
const achievementAggregate = aggregateCourseAchievements(data, courses);
assert.deepEqual(achievementAggregate.completed, [
  "ielts:ielts-speak",
  "remote:remote-speak",
]);
assert.deepEqual(achievementAggregate.listeningCompleted, [
  "ielts:ielts-listen",
]);
assert.deepEqual(achievementAggregate.liveCompleted, [
  "ielts:ielts-live",
  "remote:remote-live",
]);

const fallback = buildCourseProgressSummary({
  courses: [],
  data,
  fallbackCatalog: {
    levels: [
      {
        id: "a1",
        name: "A1",
        units: [unit("ielts-speak", "a1", "IELTS speaking")],
      },
    ],
    listening: [],
    liveTopics: [],
  },
});
assert.equal(fallback.courseCount, 1);
assert.equal(fallback.total, 1);
assert.equal(fallback.completed, 1);
assert.equal(fallback.levels[0].units[0].courseId, "ielts");

const purchased = buildCourseProgressSummary({
  courses: [
    {
      id: "purchased",
      purchaseStatus: "paid",
      progress: { completed: 1, total: 2 },
    },
    {
      id: "available",
      status: "published",
      progress: { completed: 0, total: 8 },
    },
  ],
});
assert.equal(purchased.courseCount, 1);
assert.equal(purchased.total, 2);
assert.equal(purchased.completed, 1);

console.log("progress aggregate tests passed");
