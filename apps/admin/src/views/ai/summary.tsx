import type { DataTableColumns } from "naive-ui";
import type { AISummary } from "~/api/ai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { RefreshCw as RefreshIcon, Trash2 as TrashIcon } from "lucide-vue-next";
import {
  NButton,
  NCard,
  NDataTable,
  NEllipsis,
  NPopconfirm,
  NTag,
} from "naive-ui";
import { computed, defineComponent, ref } from "vue";
import { toast } from "vue-sonner";

import { aiApi } from "~/api/ai";
import { HeaderActionButton } from "~/components/button/header-action-button";
import { RelativeTime } from "~/components/time/relative-time";
import { queryKeys } from "~/hooks/queries/keys";
import { useLayout } from "~/layouts/content";

export default defineComponent({
  name: "AISummaryPage",
  setup() {
    const queryClient = useQueryClient();
    const page = ref(1);
    const pageSize = ref(20);

    const { setActions } = useLayout();
    const { data, isFetching, refetch } = useQuery({
      queryKey: computed(() =>
        queryKeys.ai.summariesList({
          page: page.value,
          size: pageSize.value,
        }),
      ),
      queryFn: () =>
        aiApi.getSummaries({
          page: page.value,
          size: pageSize.value,
        }),
    });

    const deleteMutation = useMutation({
      mutationFn: aiApi.deleteSummary,
      onSuccess: () => {
        toast.success("摘要已删除");
        queryClient.invalidateQueries({ queryKey: queryKeys.ai.summaries() });
      },
    });

    setActions(
      <HeaderActionButton
        icon={<RefreshIcon />}
        name="刷新"
        onClick={() => refetch()}
      />,
    );

    const rows = computed(() => data.value?.items ?? []);
    const pagination = computed(() => data.value?.pagination);

    const columns: DataTableColumns<AISummary> = [
      {
        title: "引用 ID",
        key: "refId",
        width: 220,
        render: row => (
          <span class="font-mono text-xs text-neutral-500">{row.refId}</span>
        ),
      },
      {
        title: "语言",
        key: "lang",
        width: 90,
        render: row => <NTag size="small">{row.lang}</NTag>,
      },
      {
        title: "摘要",
        key: "summary",
        render: row => (
          <NEllipsis lineClamp={2} tooltip>
            {row.summary}
          </NEllipsis>
        ),
      },
      {
        title: "创建时间",
        key: "created",
        width: 140,
        render: row => <RelativeTime time={row.created} />,
      },
      {
        title: "操作",
        key: "action",
        width: 90,
        render: row => (
          <NPopconfirm
            positiveText="取消"
            negativeText="删除"
            onNegativeClick={() => deleteMutation.mutate(row._id)}
          >
            {{
              trigger: () => (
                <NButton quaternary size="tiny" type="error">
                  <TrashIcon class="size-4" />
                </NButton>
              ),
              default: () => "确定要删除这条 AI 摘要吗？",
            }}
          </NPopconfirm>
        ),
      },
    ];

    return () => (
      <div class="p-4">
        <NCard title="AI 摘要">
          <NDataTable
            columns={columns}
            data={rows.value}
            loading={isFetching.value}
            rowKey={row => row._id}
            pagination={{
              page: page.value,
              pageSize: pageSize.value,
              itemCount: pagination.value?.total ?? 0,
              pageCount: pagination.value?.total_page ?? 0,
              showSizePicker: true,
              pageSizes: [10, 20, 50, 100],
              onUpdatePage: (nextPage: number) => {
                page.value = nextPage;
              },
              onUpdatePageSize: (nextSize: number) => {
                pageSize.value = nextSize;
                page.value = 1;
              },
            }}
          />
        </NCard>
      </div>
    );
  },
});
