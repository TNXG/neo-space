import type { PropType } from "vue";
import type { TopicModel } from "~/models/topic";
import { Hash, Pencil, Search, Trash2 } from "lucide-vue-next";
import { NButton, NPopconfirm } from "naive-ui";
import { defineComponent } from "vue";

import { textToBigCharOrWord } from "~/utils/word";

export const TopicListItem = defineComponent({
  name: "TopicListItem",
  props: {
    topic: {
      type: Object as PropType<TopicModel>,
      required: true,
    },
    onEdit: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    onViewDetail: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="group px-4 py-4 border-b border-neutral-200 flex gap-4 transition-colors items-center last:border-b-0 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
        <div class="shrink-0">
          {props.topic.icon
            ? (
                <img
                  src={props.topic.icon}
                  alt={`${props.topic.name} 图标`}
                  class="rounded-xl size-12 object-cover"
                  loading="lazy"
                />
              )
            : (
                <div class="text-lg text-neutral-600 font-semibold rounded-xl flex size-12 items-center justify-center from-neutral-100 to-neutral-200 bg-gradient-to-br dark:text-neutral-300 dark:from-neutral-800 dark:to-neutral-700">
                  {textToBigCharOrWord(props.topic.name)}
                </div>
              )}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex gap-2 min-w-0 items-center">
            <h3
              class="text-base text-neutral-900 font-medium shrink-0 truncate dark:text-neutral-100"
              style={{ maxWidth: "40%" }}
            >
              {props.topic.name}
            </h3>
            <span class="text-sm text-neutral-400 flex gap-1 min-w-0 items-center">
              <Hash class="shrink-0 size-3.5" aria-hidden="true" />
              <span class="font-mono truncate">{props.topic.slug}</span>
            </span>
          </div>
          {props.topic.introduce && (
            <p class="text-sm text-neutral-500 mt-1 line-clamp-1 dark:text-neutral-400">
              {props.topic.introduce}
            </p>
          )}
          {props.topic.description && (
            <p class="text-sm text-neutral-400 mt-0.5 line-clamp-1 dark:text-neutral-500">
              {props.topic.description}
            </p>
          )}
        </div>

        <div class="flex shrink-0 gap-1 items-center">
          <NButton
            size="tiny"
            quaternary
            onClick={() => props.onViewDetail(props.topic.id!)}
            aria-label={`查看 ${props.topic.name} 详情`}
          >
            {{
              icon: () => <Search class="text-neutral-500 size-3.5" />,
              default: () => <span class="hidden sm:inline">详情</span>,
            }}
          </NButton>

          <NButton
            size="tiny"
            quaternary
            type="primary"
            onClick={() => props.onEdit(props.topic.id!)}
            aria-label={`编辑 ${props.topic.name}`}
          >
            {{
              icon: () => <Pencil class="size-3.5" />,
              default: () => <span class="hidden sm:inline">编辑</span>,
            }}
          </NButton>

          <NPopconfirm onPositiveClick={() => props.onDelete(props.topic.id!)}>
            {{
              trigger: () => (
                <NButton
                  size="tiny"
                  quaternary
                  type="error"
                  aria-label={`删除 ${props.topic.name}`}
                >
                  <Trash2 class="size-3.5" />
                </NButton>
              ),
              default: () => (
                <span>
                  确定要删除「
                  {props.topic.name}
                  」吗？
                </span>
              ),
            }}
          </NPopconfirm>
        </div>
      </div>
    );
  },
});

export const TopicEmptyState = defineComponent({
  name: "TopicEmptyState",
  props: {
    onAdd: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="py-16 border-2 border-neutral-200 rounded-xl border-dashed bg-neutral-50/50 flex flex-col items-center justify-center dark:border-neutral-800 dark:bg-neutral-900/50">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <Hash class="text-neutral-400 size-8" aria-hidden="true" />
        </div>
        <h3 class="text-lg text-neutral-900 font-medium mb-1 dark:text-neutral-100">
          暂无专栏
        </h3>
        <p class="text-sm text-neutral-500 mb-6 dark:text-neutral-400">
          创建专栏来组织和分类你的日记
        </p>
        <NButton type="primary" onClick={props.onAdd}>
          创建第一个专栏
        </NButton>
      </div>
    );
  },
});

export const TopicListSkeleton = defineComponent({
  name: "TopicListSkeleton",
  setup() {
    return () => (
      <div class="animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            class="px-4 py-4 border-b border-neutral-200 flex gap-4 items-center last:border-b-0 dark:border-neutral-800"
          >
            <div class="rounded-xl bg-neutral-200 size-12 dark:bg-neutral-700" />
            <div class="flex-1">
              <div class="rounded bg-neutral-200 h-5 w-36 dark:bg-neutral-700" />
              <div class="mt-2 rounded bg-neutral-100 h-4 w-56 dark:bg-neutral-800" />
            </div>
            <div class="flex gap-2">
              <div class="rounded bg-neutral-100 h-7 w-14 dark:bg-neutral-800" />
              <div class="rounded bg-neutral-100 h-7 w-14 dark:bg-neutral-800" />
            </div>
          </div>
        ))}
      </div>
    );
  },
});
