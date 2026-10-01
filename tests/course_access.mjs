import assert from "node:assert/strict";
import {
  hasCourseAccess,
  partitionCourses,
} from "../src/features/courses/courseAccess.js";

assert.equal(hasCourseAccess({ enrolled: true }), true);
assert.equal(hasCourseAccess({ enrollmentSource: "purchase" }), true);
assert.equal(hasCourseAccess({ purchased: true }), true);
assert.equal(hasCourseAccess({ purchaseStatus: "paid" }), true);
assert.equal(hasCourseAccess({ purchase: { status: "approved" } }), true);
assert.equal(hasCourseAccess({ purchaseStatus: "pending" }), false);
assert.equal(hasCourseAccess({ status: "published" }), false);

const sections = partitionCourses([
  { id: "paid", name: "Purchased copy", status: "published", purchased: true },
  { id: "paid", name: "Stale catalog copy", status: "published" },
  { id: "enrolled", status: "published", enrolled: true },
  { id: "available", status: "published" },
  { id: "available", status: "published", name: "Duplicate listing" },
  { id: "draft", status: "draft" },
]);
assert.deepEqual(
  sections.enrolled.map((course) => course.id),
  ["paid", "enrolled"],
  "purchased and enrolled courses appear only in the learner's library",
);
assert.deepEqual(
  sections.available.map((course) => course.id),
  ["available"],
  "available catalog is deduplicated and excludes courses with access",
);
assert.equal(sections.enrolled[0].name, "Purchased copy");

console.log("course access tests passed");
