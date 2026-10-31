"use client";

import type { DashboardLinkInput, Link, LinkStateType } from "@/types/api";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import {
  createDashboardLink,
  DASHBOARD_LINK_COUNT_KEY,
  dashboardLinksKey,
  deleteDashboardLink,
  getDashboardLinkCount,
  getDashboardLinks,
  isDashboardLinksKey,
  recheckAllDashboardLinks,
  recheckDashboardLink,
  updateDashboardLink,
} from "@/lib/dashboard-links";

const errorText = (error: unknown) => error instanceof Error ? error.message : "请稍后重试";

/**
 * 友链管理的数据与变更：同一状态列表共享 SWR key，写入后同步列表与计数。
 * @param state 当前状态标签
 * @param page 当前页码
 * @returns 列表、计数与变更方法
 */
export function useFriendManager(state: LinkStateType, page: number) {
  const links = useSWR(dashboardLinksKey(state, page), () => getDashboardLinks(state, page));
  const counts = useSWR(DASHBOARD_LINK_COUNT_KEY, getDashboardLinkCount);
  const { mutate } = useSWRConfig();

  /** 状态变化会让条目跨标签移动，因此失效全部列表与计数。 */
  const syncAll = () => Promise.all([mutate(isDashboardLinksKey), counts.mutate()]);

  /** 当前列表内的乐观替换 / 移除。 */
  const patchCurrent = (apply: (items: Link[]) => Link[]) =>
    links.mutate(current => current && { ...current, items: apply(current.items) }, { revalidate: false });

  const save = async (input: DashboardLinkInput, _id?: string) => {
    try {
      if (_id) await updateDashboardLink(_id, input);
      else await createDashboardLink(input);
      await syncAll();
      toast.success(_id ? "已保存" : "已添加", { description: input.state === 0 ? "正在后台检测站点与订阅源" : undefined });
      return true;
    } catch (error) {
      toast.error(`保存失败：${errorText(error)}`);
      return false;
    }
  };

  const changeState = async (link: Link, next: LinkStateType, message: string) => {
    const snapshot = links.data;
    await patchCurrent(items => items.filter(item => item._id !== link._id));
    try {
      await updateDashboardLink(link._id, { state: next });
      await syncAll();
      toast.success(message);
    } catch (error) {
      await links.mutate(snapshot, { revalidate: false });
      toast.error(`操作失败：${errorText(error)}`);
    }
  };

  const remove = async (link: Link) => {
    const snapshot = links.data;
    await patchCurrent(items => items.filter(item => item._id !== link._id));
    try {
      await deleteDashboardLink(link._id);
      await counts.mutate();
      toast.success(`已删除「${link.name}」`);
    } catch (error) {
      await links.mutate(snapshot, { revalidate: false });
      toast.error(`删除失败：${errorText(error)}`);
    }
  };

  const recheck = async (link: Link) => {
    try {
      const fresh = await recheckDashboardLink(link._id);
      await patchCurrent(items => items.map(item => item._id === link._id ? fresh : item));
      const feed = fresh.feed;
      toast.success(fresh.health?.is_alive ? `「${link.name}」在线` : `「${link.name}」无法访问`, {
        description: feed ? (feed.error_message ? `订阅源失败：${feed.error_message}` : `订阅源 ${feed.total} 篇`) : "未配置订阅源",
      });
    } catch (error) {
      toast.error(`检测失败：${errorText(error)}`);
    }
  };

  const recheckAll = () => {
    const task = recheckAllDashboardLinks().then(async (result) => {
      await mutate(isDashboardLinksKey);
      const values = Object.values(result);
      return { total: values.length, alive: values.filter(link => link.health?.is_alive).length, feeds: values.filter(link => link.feed && !link.feed.error_message).length };
    });
    toast.promise(task, {
      loading: "正在检测全部友链…",
      success: ({ total, alive, feeds }) => `完成：${alive}/${total} 在线，${feeds} 个订阅源可用`,
      error: error => `检测失败：${errorText(error)}`,
    });
    return task;
  };

  return { links, counts, save, changeState, remove, recheck, recheckAll };
}
