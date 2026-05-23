import type { PropType } from "vue";
import type {
  EnrichmentScreenshotJoinedRow,
  EnrichmentScreenshotQuota,
} from "~/models/enrichment";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import {
  ArrowLeft as ArrowLeftIcon,
  Camera as CameraIcon,
  ExternalLink as ExternalLinkIcon,
  Trash2 as TrashIcon,
} from "lucide-vue-next";
import { NButton, NPopconfirm, NScrollbar, NTag, NTooltip } from "naive-ui";
import { computed, defineComponent } from "vue";

import { toast } from "vue-sonner";

import { enrichmentApi } from "~/api/enrichment";
import { RelativeTime } from "~/components/time/relative-time";
import { queryKeys } from "~/hooks/queries/keys";

import { formatBytes } from "../../utils";

export const ScreenshotDetailPanel = defineComponent({
  name: "ScreenshotDetailPanel",
  props: {
    row: {
      type: Object as PropType<EnrichmentScreenshotJoinedRow>,
      required: true,
    },
    quota: {
      type: Object as PropType<EnrichmentScreenshotQuota | null>,
      default: null,
    },
    isMobile: { type: Boolean, default: false },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onDeleted: {
      type: Function as PropType<(enrichmentId: string) => void>,
    },
  },
  setup(props) {
    const queryClient = useQueryClient();

    const invalidateAll = () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.screenshots.all(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.screenshots.quota(),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.byId(props.row.enrichmentId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.enrichment.lists(),
      });
    };

    const deleteMutation = useMutation({
      mutationFn: () =>
        enrichmentApi.screenshots.delete(props.row.enrichmentId),
      onSuccess: () => {
        toast.success("已删除截图");
        invalidateAll();
        props.onDeleted?.(props.row.enrichmentId);
      },
    });

    const recaptureMutation = useMutation({
      mutationFn: () =>
        enrichmentApi.screenshots.recapture(props.row.enrichmentId),
      onSuccess: () => {
        toast.success("已重新截图");
        invalidateAll();
      },
    });

    const recaptureDisabledReason = computed<string | null>(() => {
      const q = props.quota;
      if (!q)
        return "配额信息加载中";
      if (!q.enabled)
        return "截图功能未启用";
      if (q.fetchMode !== "browser")
        return "当前抓取模式不支持重新截图";
      return null;
    });

    return () => {
      const { row } = props;
      const swatches = row.palette?.swatches ?? [];
      const dominant = row.palette?.dominant;
      const reason = recaptureDisabledReason.value;

      const recaptureBtn = (
        <NButton
          size="small"
          secondary
          loading={recaptureMutation.isPending.value}
          disabled={reason !== null}
          onClick={() => recaptureMutation.mutate()}
        >
          {{
            icon: () => <CameraIcon class="size-4" />,
            default: () => "重新截图",
          }}
        </NButton>
      );

      return (
        <div class="flex flex-col h-full">
          <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center justify-between dark:border-neutral-800">
            <div class="flex gap-3 min-w-0 items-center">
              {props.isMobile && props.onBack && (
                <button
                  onClick={props.onBack}
                  class="text-neutral-500 rounded-md flex shrink-0 h-8 w-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
                >
                  <ArrowLeftIcon class="h-5 w-5" />
                </button>
              )}
              <NTag size="small" type="info">
                {row.provider}
              </NTag>
              <h2 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
                {row.title || row.url}
              </h2>
            </div>

            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              class="text-neutral-500 rounded-md flex shrink-0 h-8 w-8 transition-colors items-center justify-center dark:text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              title="打开原始链接"
            >
              <ExternalLinkIcon class="h-4 w-4" />
            </a>
          </div>

          <NScrollbar class="flex-1 min-h-0">
            <div class="mx-auto p-6 max-w-3xl space-y-6">
              <div
                class="border border-neutral-200 rounded-lg bg-neutral-50 overflow-hidden dark:border-neutral-800 dark:bg-neutral-900"
                style={dominant ? { backgroundColor: dominant } : undefined}
              >
                <a
                  href={row.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block"
                >
                  <img
                    src={row.publicUrl}
                    alt={row.title || row.url}
                    loading="lazy"
                    class="w-full object-cover"
                  />
                </a>
              </div>

              <section class="space-y-3">
                <h3 class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
                  元信息
                </h3>
                <div class="border border-neutral-200 rounded-md overflow-hidden dark:border-neutral-800">
                  <table class="text-xs w-full">
                    <tbody class="divide-neutral-100 divide-y dark:divide-neutral-800">
                      <Row label="Provider">
                        <NTag size="small" type="info">
                          {row.provider}
                        </NTag>
                      </Row>
                      <Row label="External ID">
                        <code class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {row.externalId}
                        </code>
                      </Row>
                      <Row label="尺寸">
                        <span class="tabular-nums">
                          {row.width}
                          ×
                          {row.height}
                        </span>
                      </Row>
                      <Row label="大小">
                        <span class="tabular-nums">
                          {formatBytes(row.bytes)}
                        </span>
                      </Row>
                      <Row label="创建于">
                        <RelativeTime time={new Date(row.createdAt)} />
                      </Row>
                      <Row label="最近访问">
                        <RelativeTime time={new Date(row.lastAccessedAt)} />
                      </Row>
                      <Row label="对象键">
                        <code class="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-100 break-all dark:bg-neutral-800">
                          {row.objectKey}
                        </code>
                      </Row>
                    </tbody>
                  </table>
                </div>
              </section>

              {swatches.length > 0 && (
                <section class="space-y-2">
                  <h3 class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
                    调色板
                  </h3>
                  <div class="flex gap-1.5 items-center">
                    {swatches.slice(0, 5).map(c => (
                      <NTooltip key={c}>
                        {{
                          trigger: () => (
                            <span
                              class="border border-neutral-200 rounded size-7 block dark:border-neutral-800"
                              style={{ backgroundColor: c }}
                            />
                          ),
                          default: () => c,
                        }}
                      </NTooltip>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </NScrollbar>

          <div class="px-4 py-3 border-t border-neutral-200 flex shrink-0 gap-2 items-center justify-end dark:border-neutral-800">
            {reason
              ? (
                  <NTooltip>
                    {{
                      trigger: () => (
                        <span class="inline-block">{recaptureBtn}</span>
                      ),
                      default: () => reason,
                    }}
                  </NTooltip>
                )
              : (
                  recaptureBtn
                )}
            <NPopconfirm
              positiveText="保留"
              negativeText="删除"
              onNegativeClick={() => deleteMutation.mutate()}
            >
              {{
                trigger: () => (
                  <NButton
                    size="small"
                    type="error"
                    tertiary
                    loading={deleteMutation.isPending.value}
                  >
                    {{
                      icon: () => <TrashIcon class="size-4" />,
                      default: () => "删除截图",
                    }}
                  </NButton>
                ),
                default: () => "删除此截图，但保留缓存条目？",
              }}
            </NPopconfirm>
          </div>
        </div>
      );
    };
  },
});

const Row = defineComponent({
  name: "ScreenshotMetaRow",
  props: { label: { type: String, required: true } },
  setup(props, { slots }) {
    return () => (
      <tr>
        <td class="text-neutral-500 font-medium px-3 py-1.5 bg-neutral-50 w-32 dark:text-neutral-400 dark:bg-neutral-900">
          {props.label}
        </td>
        <td class="text-neutral-700 px-3 py-1.5 dark:text-neutral-300">
          {slots.default?.()}
        </td>
      </tr>
    );
  },
});
