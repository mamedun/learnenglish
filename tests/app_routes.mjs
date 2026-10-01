import assert from "node:assert/strict";
import { appRouteFor, parseAppRoute } from "../src/lib/appRoutes.js";

assert.equal(appRouteFor("home"), "/home");
assert.equal(
  appRouteFor("practice", { unitId: "a1-introductions" }),
  "/lesson/a1-introductions",
);
assert.equal(appRouteFor("practice"), "/home");
assert.equal(
  appRouteFor("listening", { listeningId: "travel-basics" }),
  "/listening/travel-basics",
);
assert.equal(appRouteFor("listening"), "/listening");
assert.deepEqual(parseAppRoute("/"), { page: "home" });
assert.deepEqual(parseAppRoute("/home"), { page: "home" });
assert.deepEqual(parseAppRoute("/lesson/a1-introductions"), {
  page: "practice",
  unitId: "a1-introductions",
});
assert.deepEqual(parseAppRoute("/listening/travel-basics"), {
  page: "listening",
  listeningId: "travel-basics",
});
assert.deepEqual(parseAppRoute("/listening"), {
  page: "listening",
  listeningId: null,
});
assert.deepEqual(parseAppRoute("/progress"), { page: "progress" });
assert.equal(parseAppRoute("/lesson/%E0%A4"), null);
assert.equal(parseAppRoute("/unknown"), null);
assert.equal(parseAppRoute("/lesson/too/many"), null);

console.log(
  "PASS: app page and lesson paths round-trip and reject invalid routes.",
);
