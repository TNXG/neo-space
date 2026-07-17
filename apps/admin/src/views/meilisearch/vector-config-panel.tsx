import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NInputNumber,
  NSkeleton,
  NSwitch,
} from "naive-ui";
import { defineComponent, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { meilisearchApi } from "~/api/meilisearch";

/** 项目级向量 API、密钥与模型配置。 */
export const MeilisearchVectorConfigPanel = defineComponent({
  name: "MeilisearchVectorConfigPanel",
  setup() {
    const queryClient = useQueryClient();
    const enabled = ref(false);
    const apiUrl = ref("");
    const apiKey = ref("");
    const clearApiKey = ref(false);
    const model = ref("");
    const dimensions = ref(1024);
    const documentTemplateMaxBytes = ref(400);

    const configQuery = useQuery({
      queryKey: ["meilisearch", "vector-config"],
      queryFn: meilisearchApi.getVectorConfig,
    });

    watch(() => configQuery.data.value, (config) => {
      if (!config)
        return;
      enabled.value = config.enabled;
      apiUrl.value = config.apiUrl;
      model.value = config.model;
      dimensions.value = config.dimensions;
      documentTemplateMaxBytes.value = config.documentTemplateMaxBytes;
      apiKey.value = "";
      clearApiKey.value = false;
    }, { immediate: true });

    const updateMutation = useMutation({
      mutationFn: () => meilisearchApi.updateVectorConfig({
        enabled: enabled.value,
        apiUrl: apiUrl.value.trim(),
        apiKey: apiKey.value.trim() || undefined,
        clearApiKey: clearApiKey.value,
        model: model.value.trim(),
        dimensions: dimensions.value,
        documentTemplateMaxBytes: documentTemplateMaxBytes.value,
      }),
      onSuccess: (config) => {
        queryClient.setQueryData(["meilisearch", "vector-config"], config);
        queryClient.invalidateQueries({ queryKey: ["meilisearch", "indexes"] });
        apiKey.value = "";
        clearApiKey.value = false;
        toast.success("项目级向量配置同步任务已提交到全部 Meilisearch 索引");
      },
    });

    return () => configQuery.isPending.value
      ? <NSkeleton height="420px" />
      : (
          <div class="space-y-5">
            <NAlert type="info" title="项目级配置">
              API、API Key、模型和维度统一应用到全部正式索引；每个索引只保留自己的文档模板。保存会触发 Meilisearch 设置任务和必要的重新向量化。
            </NAlert>
            <NCard title="向量服务">
              <NForm labelPlacement="top">
                <NFormItem label="启用项目向量化">
                  <NSwitch value={enabled.value} onUpdateValue={value => enabled.value = value} />
                </NFormItem>
                <div class="grid gap-4 lg:grid-cols-2">
                  <NFormItem label="Embeddings API URL">
                    <NInput
                      value={apiUrl.value}
                      onUpdateValue={value => apiUrl.value = value}
                      placeholder="https://api.example.com/v1/embeddings"
                    />
                  </NFormItem>
                  <NFormItem label="模型">
                    <NInput value={model.value} onUpdateValue={value => model.value = value} placeholder="embedding-model" />
                  </NFormItem>
                  <NFormItem label="API Key">
                    <NInput
                      value={apiKey.value}
                      onUpdateValue={value => apiKey.value = value}
                      type="password"
                      showPasswordOn="click"
                      placeholder={configQuery.data.value?.hasApiKey ? "已配置，留空则保持不变" : "输入 API Key"}
                      disabled={clearApiKey.value}
                    />
                  </NFormItem>
                  <NFormItem label="密钥操作">
                    <NCheckbox checked={clearApiKey.value} onUpdateChecked={value => clearApiKey.value = value}>
                      清除已保存的 API Key
                    </NCheckbox>
                  </NFormItem>
                  <NFormItem label="向量维度">
                    <NInputNumber
                      value={dimensions.value}
                      onUpdateValue={value => dimensions.value = value ?? 1024}
                      min={1}
                      max={65536}
                      class="w-full"
                    />
                  </NFormItem>
                  <NFormItem label="单文档模板最大字节数">
                    <NInputNumber
                      value={documentTemplateMaxBytes.value}
                      onUpdateValue={value => documentTemplateMaxBytes.value = value ?? 400}
                      min={1}
                      max={10000000}
                      class="w-full"
                    />
                  </NFormItem>
                </div>
              </NForm>
              <div class="flex justify-end">
                <NButton
                  class="cursor-pointer"
                  type="primary"
                  loading={updateMutation.isPending.value}
                  onClick={() => updateMutation.mutate()}
                >
                  保存并同步全部索引
                </NButton>
              </div>
            </NCard>
          </div>
        );
  },
});
