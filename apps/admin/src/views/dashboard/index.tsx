import type { DashboardContent, DashboardContentType } from "~/api/dashboard";
import { useQuery } from "@tanstack/vue-query";
import { format } from "date-fns";
import {
  BookOpen as BookIcon,
  FileText as FileTextIcon,
  Link as LinkIcon,
  MessageSquare as CommentIcon,
  Pencil as PencilIcon,
  StickyNote as NoteIcon,
  Users as UsersIcon,
} from "lucide-vue-next";
import { NButton, NEmpty, NScrollbar, NSkeleton, NTag } from "naive-ui";
import { defineComponent } from "vue";
import { RouterLink, useRouter } from "vue-router";

import { dashboardApi } from "~/api/dashboard";
import { useLayout } from "~/layouts/content";
import { RouteName } from "~/router/name";

const typeLabels: Record<DashboardContentType, string> = {
  post: "文章",
  note: "手记",
  page: "页面",
  recently: "说说",
};

const editRoutes: Partial<Record<DashboardContentType, string>> = {
  post: "/posts/edit",
  note: "/notes/edit",
  page: "/pages/edit",
  recently: "/recently",
};

export const DashBoardView = defineComponent({
  name: "DashboardView",
  setup() {
    const { setHideHeader } = useLayout();
    setHideHeader(false);
    const router = useRouter();

    const { data, isPending, isError, refetch } = useQuery({
      queryKey: ["dashboard", "overview"],
      queryFn: dashboardApi.getOverview,
    });

    return () => (
      <div class="mx-auto p-5 max-w-7xl space-y-8 md:p-8">
        <header class="flex gap-4 items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold">仪表盘</h1>
            <p class="text-sm text-neutral-500 mt-1">站点内容与社区概览</p>
          </div>
          <NButton onClick={() => refetch()} loading={isPending.value}>刷新</NButton>
        </header>

        {isPending.value
          ? <DashboardSkeleton />
          : isError.value || !data.value
            ? (
                <NEmpty description="仪表盘数据加载失败">
                  {{ extra: () => <NButton onClick={() => refetch()}>重试</NButton> }}
                </NEmpty>
              )
            : (
                <>
                  <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Metric label="全部内容" value={data.value.stats.totalContent} icon={<FileTextIcon />} />
                    <Metric label="评论" value={data.value.stats.comments} icon={<CommentIcon />} />
                    <Metric label="读者" value={data.value.stats.readers} icon={<UsersIcon />} />
                    <Metric label="友链" value={data.value.stats.links} icon={<LinkIcon />} />
                  </section>

                  <section class="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                    <div class="border border-neutral-200 rounded-lg p-5 dark:border-neutral-800">
                      <div class="mb-4 flex items-center justify-between">
                        <div>
                          <h2 class="font-medium">内容构成</h2>
                          <p class="text-xs text-neutral-500 mt-1">按当前数据库内容统计</p>
                        </div>
                        <RouterLink to="/analyze" class="text-sm text-blue-600 no-underline hover:underline">
                          查看数据
                        </RouterLink>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <ContentMetric label="文章" value={data.value.stats.posts} icon={<PencilIcon />} />
                        <ContentMetric label="手记" value={data.value.stats.notes} icon={<NoteIcon />} />
                        <ContentMetric label="页面" value={data.value.stats.pages} icon={<FileTextIcon />} />
                        <ContentMetric label="说说" value={data.value.stats.recently} icon={<BookIcon />} />
                      </div>
                    </div>

                    <div class="border border-neutral-200 rounded-lg p-5 dark:border-neutral-800">
                      <div class="mb-4">
                        <h2 class="font-medium">快速操作</h2>
                        <p class="text-xs text-neutral-500 mt-1">直接进入内容管理</p>
                      </div>
                      <div class="grid grid-cols-2 gap-3">
                        <NButton type="primary" onClick={() => router.push({ name: RouteName.EditPost })}>写文章</NButton>
                        <NButton onClick={() => router.push({ name: RouteName.EditNote })}>写手记</NButton>
                        <NButton onClick={() => router.push({ name: RouteName.ListShortHand })}>管理说说</NButton>
                        <NButton onClick={() => router.push({ name: RouteName.Friend })}>管理友链</NButton>
                      </div>
                    </div>
                  </section>

                  <section class="border border-neutral-200 rounded-lg dark:border-neutral-800">
                    <div class="px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
                      <h2 class="font-medium">最近内容</h2>
                    </div>
                    <NScrollbar class="max-h-96">
                      <div class="divide-y divide-neutral-100 dark:divide-neutral-800">
                        {data.value.recentContent.map(content => (
                          <RecentContentItem key={content._id} content={content} />
                        ))}
                      </div>
                    </NScrollbar>
                  </section>
                </>
              )}
      </div>
    );
  },
});

const Metric = defineComponent({
  props: { label: String, value: Number, icon: Object },
  setup(props) {
    return () => (
      <div class="border border-neutral-200 rounded-lg p-4 dark:border-neutral-800">
        <div class="text-neutral-500 flex items-center gap-2 text-sm">
          {props.icon}
          {props.label}
        </div>
        <div class="text-3xl font-semibold mt-3 tabular-nums">{props.value?.toLocaleString()}</div>
      </div>
    );
  },
});

const ContentMetric = defineComponent({
  props: { label: String, value: Number, icon: Object },
  setup(props) {
    return () => (
      <div class="rounded-md bg-neutral-50 p-3 dark:bg-neutral-800/50">
        <div class="text-neutral-500 flex gap-2 items-center text-sm">{props.icon}{props.label}</div>
        <div class="text-xl font-medium mt-2 tabular-nums">{props.value}</div>
      </div>
    );
  },
});

const RecentContentItem = defineComponent({
  props: {
    content: { type: Object as () => DashboardContent, required: true },
  },
  setup(props) {
    return () => {
      const route = editRoutes[props.content.type];
      const title = (
        <div class="min-w-0">
          <p class="text-sm font-medium truncate">{props.content.title}</p>
          <div class="text-xs text-neutral-500 mt-1 flex gap-2 items-center">
            <NTag size="tiny" bordered={false}>{typeLabels[props.content.type]}</NTag>
            <time>{format(new Date(props.content.created), "yyyy-MM-dd HH:mm")}</time>
          </div>
        </div>
      );
      return (
        <div class="px-5 py-3">
          {route
            ? <RouterLink to={`${route}${props.content.type === "recently" ? "" : `?id=${props.content._id}`}`} class="block text-inherit no-underline hover:text-blue-600">{title}</RouterLink>
            : title}
        </div>
      );
    };
  },
});

const DashboardSkeleton = () => (
  <div class="space-y-5">
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => <NSkeleton key={index} height="112px" />)}
    </div>
    <NSkeleton height="280px" />
  </div>
);
