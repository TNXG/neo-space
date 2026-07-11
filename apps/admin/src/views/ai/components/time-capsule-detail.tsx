import type { PropType } from "vue";
import type {
  TimeCapsuleContent,
  TimeCapsuleResult,
  TimeCapsuleSummary,
  TimeSensitivity,
} from "~/api/ai";
import { format } from "date-fns";
import {
  ArrowLeft as ArrowLeftIcon,
  Calendar as CalendarIcon,
  Hourglass as HourglassIcon,
  Sparkles as SparklesIcon,
} from "lucide-vue-next";
import { NButton, NEmpty, NScrollbar, NSelect, NTag } from "naive-ui";
import { computed, defineComponent, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";

import { aiApi } from "~/api/ai";

const sensitivityTone: Record<TimeSensitivity, "error" | "warning" | "success"> = {
  high: "error",
  medium: "warning",
  low: "success",
};

const sensitivityLabels: Record<TimeSensitivity, string> = {
  high: "高敏感",
  medium: "中等",
  low: "低敏感",
};

const editRoutes: Partial<Record<TimeCapsuleContent["type"], string>> = {
  post: "/posts/edit",
  note: "/notes/edit",
  page: "/pages/edit",
  recently: "/recently",
};

export const TimeCapsuleDetail = defineComponent({
  name: "TimeCapsuleDetail",
  props: {
    content: { type: Object as PropType<TimeCapsuleContent>, required: true },
    isMobile: { type: Boolean, default: false },
    onBack: { type: Function as PropType<() => void> },
    onRefresh: { type: Function as PropType<() => void> },
  },
  setup(props) {
    const language = ref("zh");
    const analyzing = ref(false);
    const analysisResult = ref<TimeCapsuleResult | null>(null);

    const availableLanguages = computed(() => {
      const values = new Set(props.content.availableLanguages);
      values.add("zh");
      return [...values].map(value => ({ label: value.toUpperCase(), value }));
    });
    const cachedResult = computed<TimeCapsuleSummary | null>(() =>
      [...props.content.capsules]
        .sort((left, right) => right.created.localeCompare(left.created))
        .find(capsule => capsule.lang === language.value) ?? null,
    );
    const displayedResult = computed(() => analysisResult.value ?? cachedResult.value);

    watch(
      () => props.content._id,
      () => {
        language.value = props.content.capsules[0]?.lang || "zh";
        analysisResult.value = null;
      },
      { immediate: true },
    );
    watch(language, () => (analysisResult.value = null));

    const handleAnalyze = async () => {
      analyzing.value = true;
      try {
        analysisResult.value = await aiApi.analyzeTimeCapsule({
          refId: props.content._id,
          refType: props.content.type,
          lang: language.value,
        });
        toast.success(analysisResult.value.isNew ? "分析完成" : "已读取最新缓存");
        await props.onRefresh?.();
      } catch {
        toast.error("时效性分析失败");
      } finally {
        analyzing.value = false;
      }
    };

    return () => (
      <div class="flex h-full flex-col">
        <div class="px-4 border-b border-neutral-200 flex h-12 shrink-0 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-2 items-center">
            {props.isMobile && props.onBack && (
              <button
                type="button"
                onClick={props.onBack}
                class="rounded-md flex size-8 cursor-pointer items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon class="size-5" />
              </button>
            )}
            <HourglassIcon class="text-blue-500 size-4" />
            <span class="text-sm font-medium">时光胶囊</span>
          </div>
          <div class="flex gap-2 items-center">
            <NSelect
              class="w-24"
              size="small"
              value={language.value}
              onUpdateValue={value => (language.value = value)}
              options={availableLanguages.value}
            />
            <NButton type="primary" size="small" loading={analyzing.value} onClick={handleAnalyze}>
              {{
                icon: () => <SparklesIcon class="size-4" />,
                default: () => cachedResult.value ? "检查更新" : "开始分析",
              }}
            </NButton>
          </div>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          <div class="p-5 mx-auto max-w-3xl space-y-6">
            <section>
              {editRoutes[props.content.type]
                ? (
                    <RouterLink
                      to={`${editRoutes[props.content.type]}${props.content.type === "recently" ? "" : `?id=${props.content._id}`}`}
                      class="text-lg text-neutral-900 font-semibold no-underline hover:text-blue-600 dark:text-neutral-100"
                    >
                      {props.content.title}
                    </RouterLink>
                  )
                : <h2 class="text-lg font-semibold">{props.content.title}</h2>}
              <div class="text-xs text-neutral-500 mt-2 flex gap-1 items-center">
                <CalendarIcon class="size-3" />
                {format(new Date(props.content.created), "yyyy-MM-dd HH:mm")}
              </div>
            </section>

            <div class="bg-neutral-100 h-px dark:bg-neutral-800" />

            {displayedResult.value
              ? (
                  <section class="space-y-5">
                    <div class="flex flex-wrap gap-2 items-center">
                      <NTag type={sensitivityTone[displayedResult.value.sensitivity]}>
                        {sensitivityLabels[displayedResult.value.sensitivity]}
                      </NTag>
                      <NTag bordered={false}>{language.value.toUpperCase()}</NTag>
                      {analysisResult.value?.isNew !== undefined && (
                        <NTag type={analysisResult.value.isNew ? "info" : "default"} bordered={false}>
                          {analysisResult.value.isNew ? "新分析" : "缓存有效"}
                        </NTag>
                      )}
                    </div>
                    <div>
                      <h3 class="text-sm text-neutral-500 font-medium mb-2">判断说明</h3>
                      <p class="text-sm leading-7 whitespace-pre-wrap">
                        {displayedResult.value.reason}
                      </p>
                    </div>
                    <div>
                      <h3 class="text-sm text-neutral-500 font-medium mb-2">时效标记</h3>
                      {displayedResult.value.markers.length > 0
                        ? (
                            <div class="flex flex-wrap gap-2">
                              {displayedResult.value.markers.map(marker => (
                                <NTag key={marker} size="small">{marker}</NTag>
                              ))}
                            </div>
                          )
                        : <p class="text-sm text-neutral-400">未发现明显的时效性内容</p>}
                    </div>
                  </section>
                )
              : (
                  <div class="py-20">
                    <NEmpty description={`${language.value.toUpperCase()} 尚未分析`} />
                  </div>
                )}
          </div>
        </NScrollbar>
      </div>
    );
  },
});
