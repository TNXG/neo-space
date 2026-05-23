import type { LexicalEditor } from "lexical";
import type { PropType } from "vue";
import { ImageNode } from "@haklex/rich-editor/nodes";
import { uniqBy } from "es-toolkit/compat";
import { $nodesOfType } from "lexical";
import { ImageIcon } from "lucide-vue-next";
import { NButton } from "naive-ui";
import { computed, defineComponent, ref } from "vue";

import { toast } from "vue-sonner";

import { encodeImageToThumbhash, getDominantColor } from "~/utils/image";

interface SerializedImageNode {
  type: string;
  src?: string;
  width?: number;
  height?: number;
  accent?: string;
  thumbhash?: string;
  children?: SerializedImageNode[];
}

interface LexicalImageMeta {
  src: string;
  width?: number;
  height?: number;
  accent?: string;
  thumbhash?: string;
}

const collectImageNodes = (nodes: SerializedImageNode[] = []) => {
  const images: LexicalImageMeta[] = [];

  nodes.forEach((node) => {
    if (node.type === "image" && node.src) {
      images.push({
        src: node.src,
        width: node.width,
        height: node.height,
        accent: node.accent,
        thumbhash: node.thumbhash,
      });
    }

    if (node.children?.length) {
      images.push(...collectImageNodes(node.children));
    }
  });

  return images;
};

export const LexicalImageDetailSection = defineComponent({
  name: "LexicalImageDetailSection",
  props: {
    content: {
      type: String,
      required: true,
    },
    editor: {
      type: Object as PropType<LexicalEditor | null>,
      required: false,
      default: null,
    },
  },
  setup(props) {
    const loading = ref(false);

    const images = computed(() => {
      if (!props.content) {
        return [] as LexicalImageMeta[];
      }

      try {
        const parsed = JSON.parse(props.content) as {
          root?: { children?: SerializedImageNode[] };
        };
        return uniqBy(collectImageNodes(parsed.root?.children), "src");
      } catch {
        return [] as LexicalImageMeta[];
      }
    });

    const handleCorrectImageDimensions = async () => {
      if (!props.editor) {
        toast.warning("Lexical 编辑器尚未就绪");
        return;
      }

      loading.value = true;

      const fetchImageTasks = await Promise.allSettled(
        images.value.map((item) => {
          return new Promise<LexicalImageMeta>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "Anonymous";
            image.src = item.src;

            image.addEventListener("load", async () => {
              try {
                let accent = item.accent;
                let thumbhash = item.thumbhash;

                try {
                  accent = getDominantColor(image);
                } catch {
                  // Cross-origin images may block canvas reads.
                }

                try {
                  thumbhash = await encodeImageToThumbhash(image);
                } catch {
                  // Keep existing thumbhash when recomputing is not possible.
                }

                resolve({
                  src: item.src,
                  width: image.naturalWidth,
                  height: image.naturalHeight,
                  accent,
                  thumbhash,
                });
              } catch (error) {
                reject({
                  err: error,
                  src: item.src,
                });
              }
            });

            image.onerror = (err) => {
              reject({
                err,
                src: item.src,
              });
            };
          });
        }),
      );

      const nextImageMetaMap = new Map<string, LexicalImageMeta>();

      fetchImageTasks.forEach((task) => {
        if (task.status === "fulfilled") {
          nextImageMetaMap.set(task.value.src, task.value);
          return;
        }

        toast.warning(`获取图片信息失败：${task.reason.src}`);
      });

      props.editor.update(() => {
        const imageNodes = $nodesOfType(ImageNode);
        imageNodes.forEach((node) => {
          const nextMeta = nextImageMetaMap.get(node.getSrc());
          if (!nextMeta)
            return;

          node.setDimensions(nextMeta.width, nextMeta.height);
          node.setAccent(nextMeta.accent);
          node.setThumbhash(nextMeta.thumbhash);
        });
      });

      loading.value = false;
    };

    return () => (
      <div class="flex flex-col w-full">
        <div class="flex gap-3 items-center justify-between">
          <span class="text-sm text-neutral-500">
            调整 Lexical 中的图片信息
          </span>
          <NButton
            loading={loading.value}
            size="tiny"
            onClick={handleCorrectImageDimensions}
            type="primary"
            tertiary
            disabled={!props.editor || images.value.length === 0}
          >
            自动修正
          </NButton>
        </div>

        {images.value.length > 0
          ? (
              <div class="mt-4 space-y-2">
                {images.value.map((image) => {
                  const fileName = image.src.split("/").pop() || image.src;
                  return (
                    <div
                      key={image.src}
                      class="px-3 py-2.5 border border-neutral-200 rounded-lg dark:border-neutral-700"
                    >
                      <div class="text-sm text-neutral-700 flex gap-2 items-center dark:text-neutral-200">
                        <ImageIcon class="text-neutral-400 flex-shrink-0 h-4 w-4" />
                        <span class="flex-1 min-w-0 truncate">{fileName}</span>
                      </div>
                      <div class="text-xs text-neutral-400 mt-1">
                        {image.width && image.height
                          ? `${image.width}×${image.height}`
                          : "未写入尺寸"}
                        {image.accent ? " · 已有 accent" : ""}
                        {image.thumbhash ? " · 已有 thumbhash" : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          : (
              <div class="text-sm text-neutral-400 mt-4 px-3 py-4 border border-neutral-200 rounded-lg border-dashed dark:border-neutral-700">
                当前 Lexical 内容中没有图片节点
              </div>
            )}
      </div>
    );
  },
});
