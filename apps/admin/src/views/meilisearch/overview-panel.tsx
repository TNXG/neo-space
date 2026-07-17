import type { MeilisearchOverview } from "~/api/meilisearch";
import { useQuery } from "@tanstack/vue-query";
import { Activity, Database, HardDrive, RefreshCw } from "lucide-vue-next";
import { NButton, NCard, NEmpty, NProgress, NSkeleton, NTag } from "naive-ui";
import { computed, defineComponent } from "vue";

import { meilisearchApi } from "~/api/meilisearch";

/** 将字节数格式化为适合运维面板阅读的单位。 */
const formatBytes = (bytes: number): string => {
  if (bytes < 1024)
    return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
};

/** Meilisearch 服务健康与容量概览。 */
export const MeilisearchOverviewPanel = defineComponent({
  name: "MeilisearchOverviewPanel",
  setup() {
    const overviewQuery = useQuery({
      queryKey: ["meilisearch", "overview"],
      queryFn: meilisearchApi.getOverview,
      refetchInterval: 15_000,
    });
    const indexEntries = computed(() =>
      Object.entries(overviewQuery.data.value?.stats.indexes ?? {}),
    );
    const totalDocuments = computed(() =>
      indexEntries.value.reduce((total, [, stats]) => total + stats.numberOfDocuments, 0),
    );

    return () => (
      <div class="space-y-5">
        {overviewQuery.isPending.value
          ? <NSkeleton height="280px" />
          : overviewQuery.isError.value || !overviewQuery.data.value
            ? (
                <NEmpty description="无法连接 Meilisearch">
                  {{
                    extra: () => (
                      <NButton class="cursor-pointer" onClick={() => overviewQuery.refetch()}>
                        重试
                      </NButton>
                    ),
                  }}
                </NEmpty>
              )
            : <OverviewContent overview={overviewQuery.data.value} totalDocuments={totalDocuments.value} />}
      </div>
    );
  },
});

/** 渲染已加载的概览内容。 */
const OverviewContent = defineComponent({
  props: {
    overview: { type: Object as () => MeilisearchOverview, required: true },
    totalDocuments: { type: Number, required: true },
  },
  setup(props) {
    return () => (
      <>
        <section class="grid gap-4 lg:grid-cols-4">
          <MetricCard
            title="服务状态"
            value={props.overview.health.status === "available" ? "可用" : props.overview.health.status}
            icon={<Activity />}
            extra={<NTag type={props.overview.health.status === "available" ? "success" : "error"} size="small">实时</NTag>}
          />
          <MetricCard title="版本" value={props.overview.version.pkgVersion} icon={<RefreshCw />} />
          <MetricCard title="索引数量" value={Object.keys(props.overview.stats.indexes).length.toString()} icon={<Database />} />
          <MetricCard title="文档总数" value={props.totalDocuments.toLocaleString()} icon={<HardDrive />} />
        </section>

        <NCard title="存储与索引状态" bordered>
          <div class="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div>
              <div class="text-sm opacity-60">数据库占用</div>
              <div class="text-2xl font-semibold mt-2">{formatBytes(props.overview.stats.databaseSize)}</div>
              {props.overview.stats.usedDatabaseSize !== undefined && (
                <div class="text-xs opacity-60 mt-1">
                  有效数据 {formatBytes(props.overview.stats.usedDatabaseSize)}
                </div>
              )}
            </div>
            <div class="space-y-3">
              {Object.entries(props.overview.stats.indexes).map(([uid, stats]) => (
                <div key={uid} class="grid gap-2 sm:grid-cols-[160px_1fr_auto] sm:items-center">
                  <code>{uid}</code>
                  <NProgress
                    percentage={props.totalDocuments === 0 ? 0 : Math.round(stats.numberOfDocuments / props.totalDocuments * 100)}
                    showIndicator={false}
                  />
                  <span class="text-sm tabular-nums">
                    {stats.numberOfDocuments.toLocaleString()}
                    {stats.isIndexing && <NTag class="ml-2" type="warning" size="small">写入中</NTag>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </NCard>
      </>
    );
  },
});

/** 单个概览指标卡片。 */
const MetricCard = defineComponent({
  props: {
    title: { type: String, required: true },
    value: { type: String, required: true },
    icon: { type: Object, required: true },
    extra: { type: Object, required: false },
  },
  setup(props) {
    return () => (
      <NCard bordered>
        <div class="flex items-start justify-between">
          <span class="opacity-60 size-5">{props.icon}</span>
          {props.extra}
        </div>
        <div class="text-2xl font-semibold mt-4">{props.value}</div>
        <div class="text-sm opacity-60 mt-1">{props.title}</div>
      </NCard>
    );
  },
});
