import assert from "node:assert/strict";
import { test } from "node:test";
import { settingGroups } from "../src/components/dashboard/settings/settings-groups";
import { validateSettings } from "../src/components/dashboard/settings/settings-validation";

const aiGroup = settingGroups.find(group => group.key === "ai")!;

/** Jev is a decision API, so assigning it to a chat-only feature must fail before saving. */
test("rejects Jev for article analysis while allowing it for comment review", () => {
  const provider = { id: "jev", type: "jev", endpoint: "https://api.typesafe.ai/v1", apiKey: "secret", defaultModel: "jev-latest", enabled: true };
  const issues = validateSettings(aiGroup, { providers: [provider], enableSummary: true, summaryModel: { providerId: "jev" }, commentReviewModel: { providerId: "jev" } });
  assert.ok(issues.some(issue => issue.path === "summaryModel.providerId"));
  assert.equal(issues.some(issue => issue.path.startsWith("commentReviewModel")), false);
});

/** An enabled Jev assignment without its mandatory credential must not look ready. */
test("rejects a Jev service with no API key", () => {
  const issues = validateSettings(aiGroup, { providers: [{ id: "jev", type: "jev", endpoint: "https://api.typesafe.ai/v1", defaultModel: "jev-latest", enabled: true }], commentReviewModel: { providerId: "jev" } });
  assert.ok(issues.some(issue => issue.path === "providers.0.apiKey"));
});

/** Enabling review must resolve the saved AI assignment, not merely accept an on switch. */
test("requires a usable saved provider before enabling AI review", () => {
  const group = settingGroups.find(item => item.key === "commentOptions")!;
  const issues = validateSettings(group, { antiSpam: true, aiReview: true }, { ai: { providers: [] } });
  assert.ok(issues.some(issue => issue.path === "aiReview"));
});

/** Disabled review must remain savable without any AI service, including during recovery. */
test("allows disabling review when its service is missing", () => {
  const group = settingGroups.find(item => item.key === "commentOptions")!;
  assert.deepEqual(validateSettings(group, { antiSpam: true, aiReview: false }, { ai: { providers: [] } }), []);
});
