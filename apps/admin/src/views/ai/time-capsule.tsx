import type { TimeCapsuleResult, TimeSensitivity } from "~/api/ai";
import {
  Hourglass as HourglassIcon,
  Loader2 as LoaderIcon,
  Sparkles as SparklesIcon,
} from "lucide-vue-next";
import {
  NButton,
  NCard,
  NEmpty,
  NInput,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpace,
  NSpin,
  NTag,
} from "naive-ui";
import { computed, defineComponent, ref } from "vue";

import { toast } from "vue-sonner";
import { aiApi } from "~/api/ai";

const sensitivityTone: Record<
  TimeSensitivity,
  "error" | "warning" | "success"
> = {
  high: "error",
  medium: "warning",
  low: "success",
};

const sensitivityLabel: Record<TimeSensitivity, string> = {
  high: "高（内容易过期）",
  medium: "中等",
  low: "低（长期适用）",
};

const refTypeOptions = [
  { label: "Post", value: "Post" },
  { label: "Note", value: "Note" },
  { label: "Page", value: "Page" },
  { label: "Recently", value: "Recently" },
];

const langOptions = [
  { label: "中文", value: "zh" },
  { label: "日本語", value: "ja" },
  { label: "English", value: "en" },
];

export default defineComponent({
  name: "AITimeCapsulePage",
  setup() {
    const refId = ref("");
    const refType = ref<string>("Post");
    const lang = ref<string>("zh");
    const loading = ref(false);
    const result = ref<TimeCapsuleResult | null>(null);

    const sensitivity = computed(() => result.value?.sensitivity);

    const handleAnalyze = async () => {
      const id = refId.value.trim();
      if (!id) {
        toast.warning("请填入 refId（笔记 / 文章 ID）");
        return;
      }
      loading.value = true;
      try {
        const data = await aiApi.analyzeTimeCapsule({
          refId: id,
          refType: refType.value,
          lang: lang.value,
        });
        result.value = data;
        toast.success(data.isNew ? "已重新分析" : "已读取缓存结果");
      } catch {
        toast.error("生成失败");
      } finally {
        loading.value = false;
      }
    };

    const handleLoad = async () => {
      const id = refId.value.trim();
      if (!id) {
        toast.warning("请填入 refId");
        return;
      }
      loading.value = true;
      try {
        const data = await aiApi.getTimeCapsule(id, {
          refType: refType.value,
          lang: lang.value,
        });
        result.value = data;
        if (!data)
          toast.info("暂无缓存的时光胶囊记录");
      } catch {
        toast.error("读取失败");
      } finally {
        loading.value = false;
      }
    };

    return () => (
      <div class="mx-auto p-6 max-w-3xl space-y-4">
        <NCard title="时光胶囊">
          {{
            "header-extra": () => (
              <NTag type="info">
                {{
                  icon: () => <HourglassIcon class="size-3.5" />,
                  default: () => "AI 时效性分析",
                }}
              </NTag>
            ),
            "default": () => (
              <NSpace vertical size={16}>
                <p class="text-sm opacity-70">
                  分析指定内容的时间敏感度。AI 会判断文中是否含版本号、当下事件、价格等易过期信息。
                </p>
                <NInput
                  v-model:value={refId.value}
                  placeholder="refId（ObjectId）"
                  clearable
                />
                <NSpace>
                  <NRadioGroup v-model:value={refType.value}>
                    {refTypeOptions.map(opt => (
                      <NRadioButton key={opt.value} value={opt.value}>
                        {opt.label}
                      </NRadioButton>
                    ))}
                  </NRadioGroup>
                  <NSelect
                    v-model:value={lang.value}
                    options={langOptions}
                    style="width: 140px"
                  />
                </NSpace>
                <NSpace>
                  <NButton onClick={handleLoad} disabled={loading.value}>
                    读取缓存
                  </NButton>
                  <NButton
                    type="primary"
                    onClick={handleAnalyze}
                    loading={loading.value}
                  >
                    {{
                      icon: () =>
                        loading.value
                          ? (
                              <LoaderIcon class="animate-spin" />
                            )
                          : (
                              <SparklesIcon />
                            ),
                      default: () => "分析时效性",
                    }}
                  </NButton>
                </NSpace>
              </NSpace>
            ),
          }}
        </NCard>

        <NCard title="结果">
          {loading.value
            ? (
                <div class="py-8 flex justify-center">
                  <NSpin />
                </div>
              )
            : result.value
              ? (
                  <NSpace vertical size={12}>
                    <NSpace align="center">
                      <span class="text-sm opacity-70">敏感度：</span>
                      {sensitivity.value && (
                        <NTag type={sensitivityTone[sensitivity.value]}>
                          {sensitivityLabel[sensitivity.value]}
                        </NTag>
                      )}
                      <NTag type={result.value.isNew ? "info" : "default"} size="small">
                        {result.value.isNew ? "新分析" : "缓存命中"}
                      </NTag>
                    </NSpace>
                    <div>
                      <div class="text-sm mb-1 opacity-70">说明</div>
                      <p class="text-sm whitespace-pre-wrap">{result.value.reason}</p>
                    </div>
                    {result.value.markers.length > 0 && (
                      <div>
                        <div class="text-sm mb-1 opacity-70">关键词</div>
                        <NSpace size={4}>
                          {result.value.markers.map((m, i) => (
                            <NTag key={i} size="small">
                              {m}
                            </NTag>
                          ))}
                        </NSpace>
                      </div>
                    )}
                  </NSpace>
                )
              : (
                  <NEmpty description="暂无结果" />
                )}
        </NCard>
      </div>
    );
  },
});
