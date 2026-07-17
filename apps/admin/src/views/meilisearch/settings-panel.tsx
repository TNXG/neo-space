import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDynamicTags,
  NForm,
  NFormItem,
  NInput,
  NSkeleton,
} from "naive-ui";
import { defineComponent, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { meilisearchApi } from "~/api/meilisearch";

/** 将未知设置字段安全格式化为 JSON。 */
const stringifySetting = (value: unknown, fallback: unknown): string =>
  JSON.stringify(value ?? fallback, null, 2);

/** 解析必须是对象的 JSON 设置。 */
const parseObject = (source: string, fieldName: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new TypeError(`${fieldName} 必须是 JSON 对象`);
  return parsed as Record<string, unknown>;
};

/** 索引搜索、过滤、排序、词典与向量化配置面板。 */
export const MeilisearchSettingsPanel = defineComponent({
  name: "MeilisearchSettingsPanel",
  props: {
    indexUid: { type: String, required: true },
  },
  setup(props) {
    const queryClient = useQueryClient();
    const searchableAttributes = ref<string[]>([]);
    const filterableAttributes = ref<string[]>([]);
    const sortableAttributes = ref<string[]>([]);
    const rankingRules = ref<string[]>([]);
    const stopWords = ref<string[]>([]);
    const synonyms = ref("{}");
    const advancedSettings = ref("{}");

    const settingsQuery = useQuery({
      queryKey: ["meilisearch", "settings", () => props.indexUid],
      queryFn: () => meilisearchApi.getSettings(props.indexUid),
    });

    /** 把服务端配置同步到结构化表单。 */
    const hydrateForm = (settings: Record<string, unknown>): void => {
      searchableAttributes.value = [...(settings.searchableAttributes as string[] ?? [])];
      filterableAttributes.value = [...(settings.filterableAttributes as string[] ?? [])];
      sortableAttributes.value = [...(settings.sortableAttributes as string[] ?? [])];
      rankingRules.value = [...(settings.rankingRules as string[] ?? [])];
      stopWords.value = [...(settings.stopWords as string[] ?? [])];
      synonyms.value = stringifySetting(settings.synonyms, {});
      advancedSettings.value = stringifySetting(settings, {});
    };

    watch(() => settingsQuery.data.value, (settings) => {
      if (settings)
        hydrateForm(settings);
    }, { immediate: true });

    const updateMutation = useMutation({
      mutationFn: (settings: Record<string, unknown>) =>
        meilisearchApi.updateSettings(props.indexUid, settings),
      onSuccess: () => {
        toast.success("索引配置已进入 Meilisearch 任务队列");
        queryClient.invalidateQueries({ queryKey: ["meilisearch", "settings", props.indexUid] });
      },
    });

    /** 保存结构化配置，同时保留后端支持的其他字段。 */
    const saveStructuredSettings = (): void => {
      try {
        const current = settingsQuery.data.value ?? {};
        updateMutation.mutate({
          ...current,
          searchableAttributes: searchableAttributes.value,
          filterableAttributes: filterableAttributes.value,
          sortableAttributes: sortableAttributes.value,
          rankingRules: rankingRules.value,
          stopWords: stopWords.value,
          synonyms: parseObject(synonyms.value, "同义词"),
        });
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : "配置 JSON 格式错误");
      }
    };

    /** 保存完整高级 JSON，用于新版本参数和实验性向量配置。 */
    const saveAdvancedSettings = (): void => {
      try {
        updateMutation.mutate(parseObject(advancedSettings.value, "高级配置"));
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : "高级配置 JSON 格式错误");
      }
    };

    return () => settingsQuery.isPending.value
      ? <NSkeleton height="420px" />
      : (
          <div class="space-y-4">
            <NCard title="搜索与排序" size="small">
              <NForm labelPlacement="top">
                <div class="grid gap-3 lg:grid-cols-2">
                  <NFormItem label="可搜索字段">
                    <NDynamicTags value={searchableAttributes.value} onUpdateValue={value => searchableAttributes.value = value} />
                  </NFormItem>
                  <NFormItem label="过滤字段">
                    <NDynamicTags value={filterableAttributes.value} onUpdateValue={value => filterableAttributes.value = value} />
                  </NFormItem>
                  <NFormItem label="排序字段">
                    <NDynamicTags value={sortableAttributes.value} onUpdateValue={value => sortableAttributes.value = value} />
                  </NFormItem>
                  <NFormItem label="Ranking Rules（按顺序生效）">
                    <NDynamicTags value={rankingRules.value} onUpdateValue={value => rankingRules.value = value} />
                  </NFormItem>
                </div>
              </NForm>
            </NCard>

            <NCard title="词典配置" size="small">
              <div class="grid gap-4 lg:grid-cols-2">
                <NFormItem label="停用词">
                  <NDynamicTags value={stopWords.value} onUpdateValue={value => stopWords.value = value} />
                </NFormItem>
                <NFormItem label="同义词 JSON">
                  <NInput value={synonyms.value} onUpdateValue={value => synonyms.value = value} type="textarea" autosize={{ minRows: 5, maxRows: 12 }} />
                </NFormItem>
              </div>
            </NCard>

            <div class="flex justify-end">
              <NButton
                class="cursor-pointer"
                type="primary"
                loading={updateMutation.isPending.value}
                onClick={saveStructuredSettings}
              >
                保存索引配置
              </NButton>
            </div>

            <NCollapse>
              <NCollapseItem title="完整高级配置" name="advanced">
                <p class="text-sm opacity-60 mb-3">
                  可维护 typoTolerance、faceting、pagination、searchCutoffMs 及未来版本新增参数。
                </p>
                <NInput value={advancedSettings.value} onUpdateValue={value => advancedSettings.value = value} type="textarea" autosize={{ minRows: 16, maxRows: 32 }} />
                <div class="flex justify-end mt-3">
                  <NButton class="cursor-pointer" loading={updateMutation.isPending.value} onClick={saveAdvancedSettings}>
                    保存完整配置
                  </NButton>
                </div>
              </NCollapseItem>
            </NCollapse>
          </div>
        );
  },
});
