"use client";

import type { ApiResponse, PaginatedData } from "@/types/api";
import type { DashboardComment, DashboardCommentState } from "@/types/dashboard-comments";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { commentPageAfterRefresh } from "@/components/dashboard/comments/comment-model";
import { dashboardCommentsKey, getDashboardComments, isDashboardCommentsKey } from "@/lib/dashboard-comments";

/** Owner comment list, page-local selection, mutation feedback and coherent cache refresh. */
export function useDashboardComments() {
  const [state, setState] = useState<DashboardCommentState>(3);
  const [page, setPage] = useState(1);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const lock = useRef(false);
  const { mutate } = useSWRConfig();
  const list = useSWR<ApiResponse<PaginatedData<DashboardComment>>>(dashboardCommentsKey(state, page), () => getDashboardComments(state, page));
  const data = list.data?.data;
  const items = data?.items ?? [];
  const checked = checkedIds.filter(_id => items.some(item => item._id === _id));
  const selected = items.find(item => item._id === selectedId) ?? null;

  useEffect(() => {
    if (data) setPage(current => commentPageAfterRefresh(current, data.pagination.total_page));
  }, [data]);

  /** Changing a scope cannot retain an invisible bulk-delete target or an old detail. */
  const changeScope = (nextState: DashboardCommentState, nextPage: number) => {
    setState(nextState);
    setPage(nextPage);
    setCheckedIds([]);
    setSelectedId(null);
    setActionError(null);
  };

  /** Successful writes invalidate every list, count and open conversation together. */
  const run = async (label: string, action: () => Promise<unknown>): Promise<boolean> => {
    if (lock.current) return false;
    lock.current = true;
    setPending("正在提交更改，请稍候…");
    setActionError(null);
    try {
      await action();
      setCheckedIds([]);
      toast.success(label);
      try {
        await mutate(isDashboardCommentsKey);
      } catch {
        setActionError("操作已完成，但最新数据刷新失败。请点击刷新；不要重复提交。");
        toast.warning("操作已完成，请刷新查看最新数据");
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "请稍后重试";
      setActionError(message);
      toast.error(`操作失败：${message}`);
      return false;
    } finally {
      setPending(null);
      lock.current = false;
    }
  };

  return {
    state, page, list, items, checked, selected, pending, actionError, run,
    changeState: (next: DashboardCommentState) => changeScope(next, 1),
    changePage: (next: number) => changeScope(state, next),
    select: setSelectedId,
    check: (_id: string, enabled: boolean) => setCheckedIds(current => enabled ? [...new Set([...current, _id])] : current.filter(value => value !== _id)),
    checkPage: (enabled: boolean) => setCheckedIds(enabled ? items.map(item => item._id) : []),
  };
}
