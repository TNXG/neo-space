import type { Link } from "@/types/api";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { FeaturedLink } from "./common";
import { groupFriends, hasLatestPost, recencyWeight, shuffle, weightedByRecency } from "./common";

const base: Link = {
  _id: "a",
  name: "A",
  url: "https://a.example",
  avatar: "",
  description: "",
  state: 0,
  type: 0,
  created: "2026-01-01T00:00:00Z",
};

const withPost: Link = { ...base, _id: "ok", feed: { link_id: "ok", feed_url: "https://a.example/feed", total: 3, checked_at: "", latest: { title: "Hello", url: "https://a.example/p/1" } } };
const failedFeed: Link = { ...base, _id: "bad", feed: { link_id: "bad", feed_url: "https://b.example/feed", total: 0, checked_at: "", error_message: "HTTP 500" } };
const noFeed: Link = { ...base, _id: "none" };
const emptyFeed: Link = { ...base, _id: "empty", feed: { link_id: "empty", feed_url: "https://c.example/feed", total: 0, checked_at: "" } };

/** 只有成功抓到带标题文章的友链才算可展示内容。 */
test("hasLatestPost requires a titled latest entry", () => {
  assert.equal(hasLatestPost(withPost), true);
  assert.equal(hasLatestPost(failedFeed), false);
  assert.equal(hasLatestPost(noFeed), false);
  assert.equal(hasLatestPost(emptyFeed), false);
});

/** 失败与无订阅的友链一起沉底。 */
test("groupFriends puts content first and sinks failures together", () => {
  const { featured, quiet } = groupFriends([noFeed, failedFeed, withPost, emptyFeed]);
  assert.deepEqual(featured.map(link => link._id), ["ok"]);
  assert.deepEqual(quiet.map(link => link._id).sort(), ["bad", "empty", "none"]);
});

/** 注入随机源只改变顺序，不跨组移动成员。 */
test("groupFriends shuffles within groups only", () => {
  const links = [withPost, { ...withPost, _id: "ok2" }, noFeed];
  for (const value of [0, 0.5, 0.999]) {
    const { featured, quiet } = groupFriends(links, () => value);
    assert.deepEqual(featured.map(link => link._id).sort(), ["ok", "ok2"]);
    assert.deepEqual(quiet.map(link => link._id), ["none"]);
  }
});

/** 洗牌返回副本且保留全部元素。 */
test("shuffle keeps input intact", () => {
  const input = [1, 2, 3, 4, 5];
  const output = shuffle(input, () => 0.42);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
  assert.deepEqual([...output].sort(), [1, 2, 3, 4, 5]);
});

const NOW = Date.parse("2026-11-01T00:00:00Z");
const postAt = (_id: string, published?: string) => ({ ...withPost, _id, feed: { ...withPost.feed!, latest: { title: _id, url: "", published } } }) as FeaturedLink;
const fresh = postAt("fresh", "2026-10-31T00:00:00Z");
const month = postAt("month", "2026-10-01T00:00:00Z");
const ancient = postAt("ancient", "2024-01-01T00:00:00Z");
const undated = postAt("undated");

/** 越新权重越高，旧文与无日期文章保底不为零。 */
test("recencyWeight decays with age and keeps a floor", () => {
  assert.ok(recencyWeight(fresh, NOW) > recencyWeight(month, NOW));
  assert.ok(recencyWeight(month, NOW) > recencyWeight(ancient, NOW));
  assert.ok(recencyWeight(ancient, NOW) > 0);
  assert.equal(recencyWeight(undated, NOW), recencyWeight(ancient, NOW));
});

/** 统计上最新文章最常排第一，但旧文章也会偶尔领先。 */
test("weightedByRecency favours recent posts without fixing the order", () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const leads: Record<string, number> = { fresh: 0, month: 0, ancient: 0 };
  for (let round = 0; round < 4000; round++) {
    leads[weightedByRecency([ancient, month, fresh], random, NOW)[0]._id]++;
  }
  assert.ok(leads.fresh > leads.month);
  assert.ok(leads.month > leads.ancient);
  assert.ok(leads.ancient > 0);
});

/** 服务端稳定输出：有文章组按发布时间倒序。 */
test("groupFriends without random sorts featured by recency", () => {
  const { featured } = groupFriends([ancient, fresh, month], undefined, NOW);
  assert.deepEqual(featured.map(link => link._id), ["fresh", "month", "ancient"]);
});
