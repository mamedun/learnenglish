import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_LIVE_TOPIC_ID,
  getLiveTopic,
  LIVE_TOPICS,
} from "../src/data/liveTopics.js";

assert.ok(LIVE_TOPICS.length >= 10, "Live Lesson needs a broad topic list");
assert.equal(
  new Set(LIVE_TOPICS.map((topic) => topic.id)).size,
  LIVE_TOPICS.length,
);
assert.equal(DEFAULT_LIVE_TOPIC_ID, LIVE_TOPICS[0].id);
for (const topic of LIVE_TOPICS) {
  assert.ok(topic.label && topic.description && topic.teacherRole);
  assert.ok(topic.learnerRole && topic.situation && topic.opening);
}

const interview = getLiveTopic("job-interview");
assert.match(interview.teacherRole, /hiring manager/i);
assert.match(interview.opening, /tell me a little about yourself/i);
assert.equal(getLiveTopic("unknown-topic").id, DEFAULT_LIVE_TOPIC_ID);

const [app, page] = await Promise.all([
  readFile(new URL("../src/app/App.jsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/live/LivePage.jsx", import.meta.url),
    "utf8",
  ),
]);
assert.match(
  app,
  /const liveInstruction = `[^`]*\$\{activeLiveTopic\.teacherRole\}/s,
);
assert.match(app, /clientContent:\s*\{/);
assert.match(app, /activeLiveTopic\.opening/);
assert.match(app, /liveTopicId=\{liveTopicId\}/);
assert.match(page, /id="live-topic-select"/);
assert.match(page, /disabled=\{liveOn \|\| liveLoading\}/);
assert.match(page, /LIVE_TOPICS\.map/);
assert.match(page, /live-conversation-title/);

console.log(
  "PASS: Live Lesson has selectable role-play topics, starts with the teacher, and gives topic-specific feedback instructions.",
);
