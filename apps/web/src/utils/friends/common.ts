import type { Link } from "@/types/api";

/** 订阅源成功抓取且有最新文章的友链 */
export type FeaturedLink = Link & { feed: NonNullable<Link["feed"]> & { latest: NonNullable<NonNullable<Link["feed"]>["latest"]> } };

export interface FriendGroups {
  /** 有文章可展示，按内容驱动排在前面 */
  featured: FeaturedLink[];
  /** 无订阅源或抓取失败，降级为名片 */
  quiet: Link[];
}

/**
 * 订阅成功且有文章标题的友链才算可展示内容。
 * @param link 友链
 * @returns 是否有可展示的最新文章
 */
export function hasLatestPost(link: Link): link is FeaturedLink {
  return Boolean(link.feed && !link.feed.error_message && link.feed.latest?.title);
}

/**
 * Fisher–Yates 洗牌，返回新数组。
 * @param items 原数组
 * @param random 随机源，便于测试注入
 * @returns 打乱后的副本
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/** 新鲜度时间尺度（天）：文章发布这么久后，权重降到刚发布时的 1/8 */
const RECENCY_SCALE_DAYS = 3;
/** 衰减幂次：越大越偏向新文章 */
const RECENCY_POWER = 3;
/** 无发布日期的文章按约三年前处理，排在末尾附近 */
const UNDATED_AGE_DAYS = 1000;
const DAY_MS = 86_400_000;

/**
 * 按最新文章发布时间计算权重：幂律衰减 1 / (1 + age/scale)^power。
 * 相比指数衰减，几个月前与几年前的文章仍能拉开差距，不会挤在同一个下限上。
 * @param link 有文章的友链
 * @param now 当前时间戳
 * @returns (0, 1] 区间内的权重
 */
export function recencyWeight(link: FeaturedLink, now: number): number {
  const published = Date.parse(link.feed.latest.published ?? "");
  const ageDays = Number.isNaN(published) ? UNDATED_AGE_DAYS : Math.max(0, now - published) / DAY_MS;
  return 1 / (1 + ageDays / RECENCY_SCALE_DAYS) ** RECENCY_POWER;
}

/**
 * 加权随机排序（Efraimidis–Spirakis）：每项取 ln(u)/w 为键降序排列，
 * 权重越大越可能靠前，但任何一项都可能出现在任意位置。
 * 用对数形式而非 u^(1/w)，避免极小权重时下溢成 0 导致并列。
 * @param links 有文章的友链
 * @param random 随机源
 * @param now 当前时间戳
 * @returns 排序后的副本
 */
export function weightedByRecency(links: readonly FeaturedLink[], random: () => number, now: number): FeaturedLink[] {
  return links
    .map(link => ({ link, key: Math.log(1 - random()) / recencyWeight(link, now) }))
    .sort((a, b) => b.key - a.key)
    .map(entry => entry.link);
}

/**
 * 内容驱动分组：有文章的友链优先，并按最新文章时间加权随机排序；
 * 其余（无订阅 / 失败）沉底并均匀打乱。
 * @param links 已通过的友链
 * @param random 随机源；不传时有文章组按发布时间倒序、其余保持原序（服务端渲染的稳定输出）
 * @param now 当前时间戳，便于测试注入
 * @returns 分组结果
 */
export function groupFriends(links: readonly Link[], random?: () => number, now: number = Date.now()): FriendGroups {
  const featured = links.filter(hasLatestPost);
  const quiet = links.filter(link => !hasLatestPost(link));
  if (!random) {
    return { featured: [...featured].sort((a, b) => recencyWeight(b, now) - recencyWeight(a, now)), quiet };
  }
  return { featured: weightedByRecency(featured, random, now), quiet: shuffle(quiet, random) };
}
