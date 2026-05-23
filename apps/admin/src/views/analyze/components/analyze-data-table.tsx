import type { TableColumns } from "naive-ui/lib/data-table/src/interface";
import type { UA } from "~/models/analyze";
import { format } from "date-fns";
import {
  Chrome as BrowserIcon,
  Clock as ClockIcon,
  Globe as GlobeIcon,
  Monitor as MonitorIcon,
  RefreshCw as RefreshOutlineIcon,
  Route as RouteIcon,
  Trash as TrashIcon,
} from "lucide-vue-next";
import { NButton, NEllipsis, NTooltip } from "naive-ui";
import {
  defineComponent,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  watch,
} from "vue";
import { useRoute } from "vue-router";

import { analyzeApi } from "~/api/analyze";
import { HeaderActionButton } from "~/components/button/header-action-button";
import { IpInfoPopover } from "~/components/ip-info";
import { DeleteConfirmButton } from "~/components/special-button/delete-confirm";
import { Table } from "~/components/table";
import { useDataTableFetch } from "~/hooks/use-table";
import { useLayout } from "~/layouts/content";
import { router } from "~/router";

export const AnalyzeDataTable = defineComponent({
  setup() {
    const route = useRoute();
    const { setActions } = useLayout();

    onMounted(() => {
      setActions(
        <>
          <HeaderActionButton
            icon={<RefreshOutlineIcon />}
            variant="success"
            name="刷新数据"
            onClick={() => {
              if (+route.query.page! === 1) {
                fetchData();
              } else {
                router.replace({
                  path: route.path,
                  query: { ...route.query, page: 1 },
                });
              }
            }}
          />
          <DeleteConfirmButton
            onDelete={async () => {
              await analyzeApi.deleteAll();

              if (Number.parseInt(route.query.page as string) === 1) {
                fetchData();
              } else {
                router.replace({
                  path: route.path,
                  query: {
                    page: 1,
                  },
                });
              }
            }}
            customSuccessMessage="已清空"
            message="你确定要清空数据表？"
            customButtonTip="清空表"
            customIcon={<TrashIcon />}
          />
        </>,
      );

      onBeforeUnmount(() => {
        setActions(null);
      });
    });

    watch(
      () => route.query.page,
      async (n) => {
        await fetchData(n ? +n : 1);
      },
    );

    const {
      data,
      pager,
      fetchDataFn: fetchData,
    } = useDataTableFetch(
      (data, pager) =>
        async (page = route.query.page || 1, size = 30) => {
          const response = await analyzeApi.getList({
            page: +page,
            size,
          });

          data.value = response.data;
          pager.value = response.pagination;
        },
    );

    onBeforeMount(() => {
      fetchData();
    });

    const columns: TableColumns<UA.Root> = [
      {
        title: "时间",
        key: "timestamp",
        minWidth: 100,
        maxWidth: 300,
        resizable: true,
        render({ timestamp }) {
          return (
            <div class="text-neutral-600 flex gap-2 items-center dark:text-neutral-300">
              <ClockIcon class="text-neutral-400 shrink-0 size-4" />
              <span class="tabular-nums">
                {format(new Date(timestamp), "MM-dd HH:mm:ss")}
              </span>
            </div>
          );
        },
      },
      {
        title: "IP 地址",
        key: "ip",
        minWidth: 100,
        maxWidth: 250,
        resizable: true,
        render({ ip }) {
          if (!ip) {
            return <span class="text-neutral-400">未知</span>;
          }
          return (
            <IpInfoPopover
              ip={ip}
              triggerEl={(
                <NButton quaternary size="tiny" type="primary">
                  <div class="flex gap-1.5 items-center">
                    <GlobeIcon class="size-3.5" />
                    <span class="font-mono">{ip}</span>
                  </div>
                </NButton>
              )}
            />
          );
        },
      },
      {
        title: "请求路径",
        key: "path",
        minWidth: 150,
        maxWidth: 600,
        resizable: true,
        render({ path }) {
          return (
            <NTooltip trigger="hover" placement="top">
              {{
                trigger: () => (
                  <div class="flex gap-2 items-center">
                    <RouteIcon class="text-neutral-400 shrink-0 size-4" />
                    <NEllipsis class="max-w-[200px]">
                      <span class="text-neutral-700 font-mono dark:text-neutral-200">
                        {path ?? ""}
                      </span>
                    </NEllipsis>
                  </div>
                ),
                default: () => (
                  <div class="text-xs font-mono max-w-[400px] break-all">
                    {path ?? ""}
                  </div>
                ),
              }}
            </NTooltip>
          );
        },
      },
      {
        key: "ua",
        title: "浏览器",
        minWidth: 120,
        maxWidth: 300,
        resizable: true,
        render({ ua }) {
          const browserInfo = ua.browser
            ? Object.values(ua.browser).filter(Boolean).join(" ")
            : null;
          return (
            <div class="flex gap-2 items-center">
              <BrowserIcon class="text-neutral-400 shrink-0 size-4" />
              <NEllipsis class="max-w-[140px]">
                <span class="text-neutral-700 dark:text-neutral-200">
                  {browserInfo || "N/A"}
                </span>
              </NEllipsis>
            </div>
          );
        },
      },
      {
        key: "ua",
        title: "操作系统",
        minWidth: 100,
        maxWidth: 250,
        resizable: true,
        render({ ua }) {
          const osInfo = ua.os
            ? Object.values(ua.os).filter(Boolean).join(" ")
            : null;
          return (
            <div class="flex gap-2 items-center">
              <MonitorIcon class="text-neutral-400 shrink-0 size-4" />
              <NEllipsis class="max-w-[110px]">
                <span class="text-neutral-700 dark:text-neutral-200">
                  {osInfo || "N/A"}
                </span>
              </NEllipsis>
            </div>
          );
        },
      },
      {
        key: "ua",
        title: "User Agent",
        minWidth: 200,
        maxWidth: 800,
        resizable: true,
        render({ ua }) {
          return (
            <NEllipsis lineClamp={2}>
              {{
                default() {
                  return (
                    <span class="text-xs text-neutral-500 dark:text-neutral-400">
                      {ua.ua ?? ""}
                    </span>
                  );
                },
                tooltip() {
                  return (
                    <div class="text-xs max-w-[500px] break-all">
                      {ua.ua ?? ""}
                    </div>
                  );
                },
              }}
            </NEllipsis>
          );
        },
      },
    ];

    return () => (
      <Table
        data={data}
        onFetchData={fetchData}
        pager={pager}
        columns={columns}
      />
    );
  },
});
