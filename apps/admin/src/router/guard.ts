import QProgress from "qier-progress";

import { userApi } from "~/api/user";
import { LayoutStore } from "~/stores/layout";

import { configs } from "../configs";
import { router } from "./router";

export const progress = new QProgress({ colorful: false, color: "#1a9cf3" });
const title = configs.title;

let layoutMutationSnapshotAtNavigation: ReturnType<
  ReturnType<typeof LayoutStore>["getMutationSnapshot"]
> | null = null;

router.beforeEach(async (to) => {
  layoutMutationSnapshotAtNavigation = LayoutStore().getMutationSnapshot();

  progress.start();

  if (to.meta.isPublic || to.fullPath.startsWith("/dev")) {

  } else {
    const { ok } = await userApi.checkLogged();
    if (!ok) {
      return `/login?from=${encodeURIComponent(to.fullPath)}`;
    }
  }
});

router.afterEach((to, from) => {
  document.title = getPageTitle(to?.meta.title as any);
  progress.finish();
  // 跨页面（route.name 变化）时重置 layout store，清除旧 VNode 引用
  // 同一页面内的参数/查询变化不重置，以保留 header actions 等状态
  // 注意：使用导航前快照 + microtask，仅重置未被新页面覆盖的字段，避免 setActions 与 reset 竞态
  if (to.name !== from.name) {
    const layoutStore = LayoutStore();
    const mutationSnapshot
      = layoutMutationSnapshotAtNavigation ?? layoutStore.getMutationSnapshot();
    queueMicrotask(() => {
      layoutStore.resetIfUnchanged(mutationSnapshot);
    });
  }
});

// HACK editor save
router.afterEach((to) => {
  if (to.hash == "|publish") {
    router.replace({ ...to, hash: "" });
  }
});

router.onError((err) => {
  progress.finish();
  if (err == "网络错误") {
    console.error("网络错误：", err);
  }
});

function getPageTitle(pageTitle?: string | null) {
  if (pageTitle) {
    return `${pageTitle} - ${title}`;
  }
  return `${title}`;
}
