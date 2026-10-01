import assert from "node:assert/strict";
import { hasCourseAccess } from "../src/features/courses/courseAccess.js";

assert.equal(hasCourseAccess({ enrolled: true }), true);
assert.equal(hasCourseAccess({ enrollmentSource: "purchase" }), true);
assert.equal(hasCourseAccess({ purchased: true }), true);
assert.equal(hasCourseAccess({ purchaseStatus: "paid" }), true);
assert.equal(hasCourseAccess({ purchase: { status: "approved" } }), true);
assert.equal(hasCourseAccess({ purchaseStatus: "pending" }), false);
assert.equal(hasCourseAccess({ status: "published" }), false);

console.log("course access tests passed");
