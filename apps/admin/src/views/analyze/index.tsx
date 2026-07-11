import type { PublicationPoint } from "~/api/dashboard";
import { useQuery } from "@tanstack/vue-query";
import { format } from "date-fns";
import {
  BarChart3 as ChartIcon,
  FileText as FileTextIcon,
  MessageSquare as CommentIcon,
  Users as UsersIcon,
} from "lucide-vue-next";
import { NButton, NDataTable, NEmpty, NSkeleton, NTag } from "naive-ui";
import { computed, defineComponent } from "vue";

import { dashboardApi } from "~/api/dashboard";

export default defineComponent({
  name: "AnalyzeView",
  setup() {
    const { data, isPending, isError, refetch } = useQuery({
      queryKey: ["dashboard", "overview"],
      queryFn: dashboardApi.getOverview,
    });
    const maxDailyCount = computed(() =>
      Math.max(
        1,
        ...(data.value?.publicationTrend.map(point =>
          point.posts + point.notes + point.pages + point.recently,
        ) ?? [1]),
      ),
    );

    return () => (
      <div class="mx-auto p-5 max-w-7xl space-y-7 md:p-8">
        <header>
          <h1 class="text-2xl font-semibold">数据</h1>
          <p class="text-sm text-neutral-500 mt-1">基于站点内容、评论与读者的真实统计</p>
        </header>

        {isPending.value
          ? <NSkeleton height="320px" />
          : isError.value || !data.value
            ? (
                <NEmpty description="数据加载失败">
                  {{ extra: () => <NButton onClick={() => refetch()}>重试</NButton> }}
                </NEmpty>
              )
            : (
                <>
                  <section class="grid gap-3 sm:grid-cols-3">
                    <OverviewCard label="内容总数" value={data.value.stats.totalContent} icon={<FileTextIcon />} />
                    <OverviewCard label="评论总数" value={data.value.stats.comments} icon={<CommentIcon />} />
                    <OverviewCard label="读者总数" value={data.value.stats.readers} icon={<UsersIcon />} />
                  </section>

                  <section class="border border-neutral-200 rounded-lg p-5 dark:border-neutral-800">
                    <div class="mb-6 flex items-center justify-between">
                      <div>
                        <h2 class="font-medium">近 30 天发布趋势</h2>
                        <p class="text-xs text-neutral-500 mt-1">文章、手记、页面与说说的每日发布量</p>
                      </div>
                      <ChartIcon class="text-neutral-400 size-5" />
                    </div>
                    <div class="h-48 flex gap-1 items-end">
                      {data.value.publicationTrend.map(point => (
                        <TrendBar key={point.date} point={point} max={maxDailyCount.value} />
                      ))}
                    </div>
                    <div class="text-xs text-neutral-400 mt-3 flex justify-between">
                      <span>{data.value.publicationTrend[0]?.date}</span>
                      <span>{data.value.publicationTrend.at(-1)?.date}</span>
                    </div>
                  </section>

                  <section class="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                    <div class="border border-neutral-200 rounded-lg p-5 dark:border-neutral-800">
                      <h2 class="font-medium">内容构成</h2>
                      <div class="mt-5 space-y-4">
                        <Composition label="文章" value={data.value.stats.posts} total={data.value.stats.totalContent} tone="bg-blue-500" />
                        <Composition label="手记" value={data.value.stats.notes} total={data.value.stats.totalContent} tone="bg-emerald-500" />
                        <Composition label="页面" value={data.value.stats.pages} total={data.value.stats.totalContent} tone="bg-amber-500" />
                        <Composition label="说说" value={data.value.stats.recently} total={data.value.stats.totalContent} tone="bg-violet-500" />
                      </div>
                    </div>

                    <div class="border border-neutral-200 rounded-lg p-5 dark:border-neutral-800">
                      <h2 class="font-medium mb-4">每日明细</h2>
                      <NDataTable
                        size="small"
                        bordered={false}
                        maxHeight={360}
                        data={[...data.value.publicationTrend].reverse()}
                        columns={trendColumns}
                        rowKey={(row: PublicationPoint) => row.date}
                      />
                    </div>
                  </section>
                </>
              )}
      </div>
    );
  },
});

const OverviewCard = defineComponent({
  props: { label: String, value: Number, icon: Object },
  setup(props) {
    return () => (
      <div class="border border-neutral-200 rounded-lg p-4 dark:border-neutral-800">
        <div class="text-neutral-500 flex items-center gap-2 text-sm">{props.icon}{props.label}</div>
        <div class="text-3xl font-semibold mt-3 tabular-nums">{props.value?.toLocaleString()}</div>
      </div>
    );
  },
});

const TrendBar = defineComponent({
  props: {
    point: { type: Object as () => PublicationPoint, required: true },
    max: { type: Number, required: true },
  },
  setup(props) {
    return () => {
      const total = props.point.posts + props.point.notes + props.point.pages + props.point.recently;
      return (
        <div class="group h-full flex min-w-0 flex-1 flex-col justify-end" title={`${props.point.date}: ${total} 篇`}>
          <div class="overflow-hidden rounded-t bg-neutral-100 dark:bg-neutral-800" style={{ height: `${Math.max(total ? 8 : 2, total / props.max * 100)}%` }}>
            <div class="bg-blue-500" style={{ height: `${props.point.posts / Math.max(total, 1) * 100}%` }} />
            <div class="bg-emerald-500" style={{ height: `${props.point.notes / Math.max(total, 1) * 100}%` }} />
            <div class="bg-amber-500" style={{ height: `${props.point.pages / Math.max(total, 1) * 100}%` }} />
            <div class="bg-violet-500" style={{ height: `${props.point.recently / Math.max(total, 1) * 100}%` }} />
          </div>
        </div>
      );
    };
  },
});

const Composition = defineComponent({
  props: { label: String, value: Number, total: Number, tone: String },
  setup(props) {
    return () => (
      <div>
        <div class="mb-1.5 flex text-sm justify-between">
          <span>{props.label}</span>
          <span class="text-neutral-500">{props.value}</span>
        </div>
        <div class="overflow-hidden rounded h-2 bg-neutral-100 dark:bg-neutral-800">
          <div class={[props.tone, "h-full rounded"]} style={{ width: `${props.total ? props.value! / props.total * 100 : 0}%` }} />
        </div>
      </div>
    );
  },
});

const trendColumns = [
  { title: "日期", key: "date", render: (row: PublicationPoint) => format(new Date(row.date), "MM-dd") },
  { title: "文章", key: "posts" },
  { title: "手记", key: "notes" },
  { title: "页面", key: "pages" },
  { title: "说说", key: "recently" },
  {
    title: "合计",
    key: "total",
    render: (row: PublicationPoint) => (
      <NTag size="small" bordered={false}>
        {row.posts + row.notes + row.pages + row.recently}
      </NTag>
    ),
  },
];
