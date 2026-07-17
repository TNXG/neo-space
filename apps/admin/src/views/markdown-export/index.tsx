import type { Component, PropType } from "vue";
import {
  BookOpen as NoteIcon,
  CheckCircle2 as SuccessIcon,
  Download as DownloadIcon,
  File as PageIcon,
  FileText as PostIcon,
  MessageSquare as RecentlyIcon,
  PackageOpen as PackageIcon,
} from "lucide-vue-next";
import { NAlert, NButton, NProgress } from "naive-ui";
import { defineComponent, h, ref } from "vue";
import { toast } from "vue-sonner";

import { useLayout } from "~/layouts/content";

import type { ExportCounts } from "./export-service";
import { createMarkdownExport, downloadBlob } from "./export-service";

/** 展示归档中包含的一类内容。 */
const ContentTypeCard = defineComponent({
  props: {
    label: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: [Object, Function] as PropType<Component>, required: true },
  },
  setup(props) {
    return () => {
      return (
        <div class="border-[var(--border-color)] bg-[var(--card-color)] rounded-lg border p-4 flex gap-3 items-start">
          <div class="bg-[var(--primary-color-suppl)] text-[var(--primary-color)] rounded-lg flex h-10 w-10 shrink-0 items-center justify-center">
            {h(props.icon, { class: "size-5" })}
          </div>
          <div>
            <h3 class="font-medium">{props.label}</h3>
            <p class="text-[var(--text-color-3)] text-sm leading-relaxed mt-1">
              {props.description}
            </p>
          </div>
        </div>
      );
    };
  },
});

/** Markdown 一键导出页面。 */
export default defineComponent({
  name: "MarkdownExportView",
  setup() {
    const exporting = ref(false);
    const counts = ref<ExportCounts | null>(null);
    const { setTitle } = useLayout();
    setTitle("Markdown 导出");

    /** 拉取全部内容、生成归档并开始下载。 */
    const handleExport = async () => {
      if (exporting.value)
        return;

      exporting.value = true;
      counts.value = null;

      try {
        const result = await createMarkdownExport();
        downloadBlob(result.blob, result.fileName);
        counts.value = result.counts;
        toast.success("Markdown 归档已生成");
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        toast.error(`导出失败：${message}`);
      } finally {
        exporting.value = false;
      }
    };

    return () => (
      <main class="mx-auto py-6 max-w-4xl space-y-6 md:py-10">
        <section class="border-[var(--border-color)] bg-[var(--card-color)] rounded-lg border p-6 md:p-8">
          <div class="flex flex-col gap-6 items-start md:flex-row md:items-center md:justify-between">
            <div class="flex gap-4 items-start">
              <div class="bg-[var(--primary-color-suppl)] text-[var(--primary-color)] rounded-lg flex h-12 w-12 shrink-0 items-center justify-center">
                <PackageIcon class="size-6" />
              </div>
              <div>
                <h2 class="text-xl font-semibold">导出全部站点内容</h2>
                <p class="text-[var(--text-color-3)] leading-relaxed mt-2 max-w-xl">
                  一次性获取页面、文章、手记和说说，生成带有 YAML Front Matter 的 Markdown 文件并按内容类型打包。
                </p>
              </div>
            </div>

            <NButton
              type="primary"
              size="large"
              loading={exporting.value}
              disabled={exporting.value}
              onClick={handleExport}
            >
              {{
                icon: () => <DownloadIcon class="size-4" />,
                default: () => exporting.value ? "正在导出" : "一键导出",
              }}
            </NButton>
          </div>

          {exporting.value && (
            <div class="mt-6">
              <NProgress
                type="line"
                status="info"
                processing
                percentage={100}
                indicatorPlacement="inside"
              />
              <p class="text-[var(--text-color-3)] text-xs mt-2">
                正在拉取全部内容并生成归档，内容较多时可能需要一些时间。
              </p>
            </div>
          )}
        </section>

        <section aria-labelledby="export-content-title">
          <h2 id="export-content-title" class="text-base font-semibold mb-3">
            归档内容
          </h2>
          <div class="grid gap-3 md:grid-cols-2">
            <ContentTypeCard
              label="页面"
              description="独立页面正文、路径、标题和发布时间。"
              icon={PageIcon}
            />
            <ContentTypeCard
              label="文章"
              description="文章正文、分类、标签、摘要和发布状态。"
              icon={PostIcon}
            />
            <ContentTypeCard
              label="手记"
              description="手记正文、编号、心情、天气、专栏和发布状态。"
              icon={NoteIcon}
            />
            <ContentTypeCard
              label="说说"
              description="说说正文、创建时间以及关联内容信息。"
              icon={RecentlyIcon}
            />
          </div>
        </section>

        {counts.value && (
          <NAlert type="success" bordered={false}>
            {{
              icon: () => <SuccessIcon class="size-5" />,
              default: () => (
                <span>
                  导出完成：{counts.value?.pages} 个页面、{counts.value?.posts} 篇文章、
                  {counts.value?.notes} 篇手记、{counts.value?.recently} 条说说。
                </span>
              ),
            }}
          </NAlert>
        )}

        <NAlert title="文件结构" type="info" bordered={false}>
          归档按 pages、posts、notes 和 recently 分目录保存；文件名会自动移除不兼容的路径字符。
        </NAlert>
      </main>
    );
  },
});
