import type { MeilisearchIndex } from "~/api/meilisearch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Database, Plus, Trash2 } from "lucide-vue-next";
import {
  NButton,
  NCard,
  NEmpty,
  NInput,
  NList,
  NListItem,
  NPopconfirm,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
} from "naive-ui";
import { computed, defineComponent, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { meilisearchApi } from "~/api/meilisearch";

import { MeilisearchDocumentsPanel } from "./documents-panel";
import { MeilisearchSettingsPanel } from "./settings-panel";

/** 索引和集合管理主面板。 */
export const MeilisearchIndexesPanel = defineComponent({
  name: "MeilisearchIndexesPanel",
  setup() {
    const queryClient = useQueryClient();
    const selectedUid = ref("");
    const newIndexUid = ref("");
    const newPrimaryKey = ref("id");
    const creating = ref(false);

    const indexesQuery = useQuery({
      queryKey: ["meilisearch", "indexes"],
      queryFn: meilisearchApi.getIndexes,
      refetchInterval: 10_000,
    });
    const indexes = computed(() => indexesQuery.data.value?.results ?? []);
    const selectedIndex = computed(() =>
      indexes.value.find(index => index.uid === selectedUid.value),
    );

    watch(indexes, (availableIndexes) => {
      if (!availableIndexes.some(index => index.uid === selectedUid.value))
        selectedUid.value = availableIndexes[0]?.uid ?? "";
    }, { immediate: true });

    /** 统一刷新索引及服务概览。 */
    const refreshIndexes = (): void => {
      queryClient.invalidateQueries({ queryKey: ["meilisearch", "indexes"] });
      queryClient.invalidateQueries({ queryKey: ["meilisearch", "overview"] });
    };

    const createMutation = useMutation({
      mutationFn: () => meilisearchApi.createIndex(newIndexUid.value, newPrimaryKey.value || undefined),
      onSuccess: () => {
        toast.success("索引创建任务已提交");
        selectedUid.value = newIndexUid.value;
        newIndexUid.value = "";
        creating.value = false;
        refreshIndexes();
      },
    });

    const deleteMutation = useMutation({
      mutationFn: meilisearchApi.deleteIndex,
      onSuccess: () => {
        toast.success("索引删除任务已提交");
        selectedUid.value = "";
        refreshIndexes();
      },
    });

    /** 校验索引名称后提交创建请求。 */
    const createIndex = (): void => {
      if (!/^[A-Za-z0-9_-]+$/.test(newIndexUid.value)) {
        toast.error("索引 UID 仅允许字母、数字、连字符和下划线");
        return;
      }
      createMutation.mutate();
    };

    return () => (
      <div class="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <NCard size="small">
          {{
            header: () => (
              <div class="flex items-center justify-between">
                <span>索引 / 集合</span>
                <NButton class="cursor-pointer" quaternary size="small" onClick={() => creating.value = !creating.value}>
                  {{ icon: () => <Plus /> }}
                </NButton>
              </div>
            ),
            default: () => (
              <>
                {creating.value && (
                  <div class="space-y-2 mb-4">
                    <NInput value={newIndexUid.value} onUpdateValue={value => newIndexUid.value = value} placeholder="索引 UID" />
                    <NInput value={newPrimaryKey.value} onUpdateValue={value => newPrimaryKey.value = value} placeholder="主键字段" />
                    <NButton class="cursor-pointer w-full" type="primary" loading={createMutation.isPending.value} onClick={createIndex}>
                      创建索引
                    </NButton>
                  </div>
                )}
                <NList hoverable clickable>
                  {indexes.value.map(index => (
                    <NListItem
                      key={index.uid}
                      class={`cursor-pointer ${selectedUid.value === index.uid ? "bg-[var(--n-merged-color)]" : ""}`}
                    >
                      <div class="cursor-pointer flex gap-3 items-center" onClick={() => selectedUid.value = index.uid}>
                        <Database class="size-4 opacity-60" />
                        <div class="min-w-0">
                          <div class="font-medium truncate">{index.uid}</div>
                          <div class="text-xs opacity-60">主键：{index.primaryKey ?? "未设置"}</div>
                        </div>
                      </div>
                    </NListItem>
                  ))}
                </NList>
              </>
            ),
          }}
        </NCard>

        {selectedIndex.value
          ? <IndexDetail index={selectedIndex.value} deleting={deleteMutation.isPending.value} onDelete={uid => deleteMutation.mutate(uid)} />
          : <NEmpty description="选择一个索引以管理文档与配置" />}
      </div>
    );
  },
});

/** 单个索引的文档与配置详情。 */
const IndexDetail = defineComponent({
  props: {
    index: { type: Object as () => MeilisearchIndex, required: true },
    deleting: { type: Boolean, required: true },
    onDelete: { type: Function as unknown as () => (uid: string) => void, required: true },
  },
  setup(props) {
    return () => (
      <NCard>
        {{
          header: () => (
            <div>
              <div class="text-lg font-semibold">{props.index.uid}</div>
              <NSpace class="mt-2">
                <NTag size="small">主键 {props.index.primaryKey ?? "未设置"}</NTag>
                <NTag size="small">更新于 {new Date(props.index.updatedAt).toLocaleString()}</NTag>
              </NSpace>
            </div>
          ),
          headerExtra: () => (
            <NPopconfirm onPositiveClick={() => props.onDelete(props.index.uid)}>
              {{
                trigger: () => (
                  <NButton class="cursor-pointer" type="error" secondary loading={props.deleting}>
                    {{ icon: () => <Trash2 />, default: () => "删除索引" }}
                  </NButton>
                ),
                default: () => "删除索引及全部文档后无法恢复，确认继续？",
              }}
            </NPopconfirm>
          ),
          default: () => (
            <NTabs type="line" animated>
              <NTabPane name="documents" tab="文档数据">
                <MeilisearchDocumentsPanel indexUid={props.index.uid} primaryKey={props.index.primaryKey ?? "id"} />
              </NTabPane>
              <NTabPane name="settings" tab="搜索与向量配置">
                <MeilisearchSettingsPanel indexUid={props.index.uid} />
              </NTabPane>
            </NTabs>
          ),
        }}
      </NCard>
    );
  },
});
