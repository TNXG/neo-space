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

/** 文章新鲜度半衰期：每过 14 天，排到前面的权重减半 */
const RECENCY_HALF_LIFE_DAYS = 14;
/** 权重下限：很久以前或无日期的文章仍有机会靠前，不会被完全压到末尾 */
const MIN_RECENCY_WEIGHT = 0.02;
const DAY_MS = 86_400_000;

/**
 * 按最新文章发布时间计算权重：指数衰减，越新越接近 1。
 * @param link 有文章的友链
 * @param now 当前时间戳
 * @returns (MIN_RECENCY_WEIGHT, 1] 区间内的权重
 */
export function recencyWeight(link: FeaturedLink, now: number): number {
  const published = Date.parse(link.feed.latest.published ?? "");
  if (Number.isNaN(published)) return MIN_RECENCY_WEIGHT;
  const ageDays = Math.max(0, now - published) / DAY_MS;
  return Math.max(MIN_RECENCY_WEIGHT, 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS));
}

/**
 * 加权随机排序（Efraimidis–Spirakis）：每项取 u^(1/w) 为键降序排列，
 * 权重越大越可能靠前，但任何一项都可能出现在任意位置。
 * @param links 有文章的友链
 * @param random 随机源
 * @param now 当前时间戳
 * @returns 排序后的副本
 */
export function weightedByRecency(links: readonly FeaturedLink[], random: () => number, now: number): FeaturedLink[] {
  return links
    .map(link => ({ link, key: random() ** (1 / recencyWeight(link, now)) }))
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
