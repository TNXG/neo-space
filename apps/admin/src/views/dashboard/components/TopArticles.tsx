import { Eye, Heart } from "lucide-vue-next";
import { NScrollbar } from "naive-ui";
import { defineComponent, onMounted, ref } from "vue";

import { aggregateApi } from "~/api/aggregate";
import { WEB_URL } from "~/constants/env";

import { ChartCard } from "./ChartCard";

interface ArticleData {
  id: string;
  title: string;
  slug: string;
  reads: number;
  likes: number;
  category: {
    name: string;
    slug: string;
  } | null;
}

export const TopArticles = defineComponent({
  setup() {
    const loading = ref(true);
    const data = ref<ArticleData[]>([]);

    const fetchData = async () => {
      try {
        const result = await aggregateApi.getTopArticles();
        data.value = Array.isArray(result) ? result : [];
      } catch {
        data.value = [];
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      fetchData();
    });

    const formatNumber = (num: number) => {
      if (num >= 10000) {
        return `${(num / 10000).toFixed(1)}w`;
      }
      if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}k`;
      }
      return num.toString();
    };

    return () => (
      <ChartCard title="热门文章 Top 10" loading={loading.value} height={250}>
        <NScrollbar style={{ maxHeight: "250px" }}>
          <div class="px-4 pb-3 space-y-1">
            {data.value.map((item, index) => (
              <a
                key={item.id}
                href={
                  item.category
                    ? `${WEB_URL}/posts/${item.category.slug}/${item.slug}`
                    : "#"
                }
                target="_blank"
                class="group px-2 py-1.5 rounded-md flex gap-3 transition-colors items-center hover:bg-neutral-100 dark:hover:bg-neutral-800"
                rel="noreferrer"
              >
                <span
                  class={[
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-medium",
                    index < 3
                      ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                      : "text-neutral-400",
                  ]}
                >
                  {index + 1}
                </span>
                <span class="text-sm text-neutral-700 flex-1 min-w-0 truncate dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100">
                  {item.title}
                </span>
                <div class="text-xs text-neutral-400 flex shrink-0 gap-3 items-center">
                  <span class="flex gap-1 items-center">
                    <Eye class="h-3 w-3" />
                    {formatNumber(item.reads)}
                  </span>
                  <span class="flex gap-1 items-center">
                    <Heart class="h-3 w-3" />
                    {formatNumber(item.likes)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </NScrollbar>
      </ChartCard>
    );
  },
});
