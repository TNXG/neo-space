import type { PropType } from "vue";
import type { PageModel } from "~/models/page";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { watchOnce } from "@vueuse/core";
import {
  Plus as AddIcon,
  ExternalLink,
  FileText,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-vue-next";
import { NButton, NPopconfirm } from "naive-ui";
import Sortable from "sortablejs";
import { defineComponent, onBeforeUnmount, ref, watchEffect } from "vue";

import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";

import { pagesApi } from "~/api/pages";
import { RelativeTime } from "~/components/time/relative-time";
import { WEB_URL } from "~/constants/env";
import { queryKeys } from "~/hooks/queries/keys";

import { HeaderActionButton } from "../../components/button/header-action-button";
import { useLayout } from "../../layouts/content";

const PageItem = defineComponent({
  name: "PageItem",
  props: {
    data: {
      type: Object as PropType<PageModel>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => {
      const row = props.data;
      return (
        <div class="group px-4 py-3 border-b border-neutral-200 flex gap-3 transition-colors items-center last:border-b-0 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
          <GripVertical class="drag-handle text-neutral-300 shrink-0 h-4 w-4 cursor-grab dark:text-neutral-600 hover:text-neutral-500 active:cursor-grabbing dark:hover:text-neutral-400" />

          <div class="flex-1 min-w-0">
            <div class="flex gap-4 items-center">
              <RouterLink
                to={`/pages/edit?id=${row._id}`}
                class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100"
              >
                {row.title}
              </RouterLink>
            </div>
            <div class="mt-0.5 flex gap-3 items-center">
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                /
                {row.slug}
              </span>
              {row.subtitle && (
                <span class="text-xs text-neutral-400 truncate dark:text-neutral-500">
                  {row.subtitle}
                </span>
              )}
            </div>
          </div>

          <div class="flex shrink-0 items-center">
            <RelativeTime
              time={row.createdAt}
              class="text-xs text-neutral-400 dark:text-neutral-500 group-hover:hidden"
            />
            <div class="gap-1 hidden items-center group-hover:flex">
              <RouterLink to={`/pages/edit?id=${row._id}`}>
                <NButton quaternary size="tiny" class="!px-2">
                  {{
                    icon: () => <Pencil class="text-neutral-500 h-3.5 w-3.5" />,
                  }}
                </NButton>
              </RouterLink>

              <a
                href={`${WEB_URL}/${row.slug}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <NButton quaternary size="tiny" class="!px-2">
                  {{
                    icon: () => (
                      <ExternalLink class="text-neutral-500 h-3.5 w-3.5" />
                    ),
                  }}
                </NButton>
              </a>

              <NPopconfirm
                positiveText="取消"
                negativeText="删除"
                onNegativeClick={() => props.onDelete(row._id)}
              >
                {{
                  trigger: () => (
                    <NButton quaternary size="tiny" class="!px-2">
                      {{
                        icon: () => <Trash2 class="text-red-500 h-3.5 w-3.5" />,
                      }}
                    </NButton>
                  ),
                  default: () => (
                    <span class="max-w-48">
                      确定要删除「
                      {row.title}
                      」？
                    </span>
                  ),
                }}
              </NPopconfirm>
            </div>
          </div>
        </div>
      );
    };
  },
});

const EmptyState = defineComponent({
  name: "EmptyState",
  setup() {
    return () => (
      <div class="py-16 flex flex-col items-center justify-center">
        <FileText class="text-neutral-300 mb-4 h-12 w-12 dark:text-neutral-600" />
        <p class="text-sm text-neutral-500 dark:text-neutral-400">还没有页面</p>
        <RouterLink
          to="/pages/edit"
          class="text-sm text-blue-500 mt-4 hover:text-blue-600 hover:underline"
        >
          创建第一个页面
        </RouterLink>
      </div>
    );
  },
});

const reorder = (data: any[], oldIndex: number, newIndex: number) => {
  const result = Array.from(data);
  const [removed] = result.splice(oldIndex, 1);
  result.splice(newIndex, 0, removed);
  return result;
};

export const ManagePageListView = defineComponent({
  name: "PageList",
  setup() {
    const queryClient = useQueryClient();

    const { data: pagesData, isLoading } = useQuery({
      queryKey: queryKeys.pages.list(),
      queryFn: () =>
        pagesApi.getList({
          page: 1,
          size: 50,
          select: "title subtitle _id created modified slug order",
        }),
    });

    const data = ref<PageModel[]>([]);

    watchEffect(() => {
      if (pagesData.value?.data) {
        data.value = [...pagesData.value.data];
      }
    });

    const deleteMutation = useMutation({
      mutationFn: pagesApi.delete,
      onSuccess: () => {
        toast.success("删除成功");
        queryClient.invalidateQueries({ queryKey: queryKeys.pages.all });
      },
    });

    const reorderMutation = useMutation({
      mutationFn: pagesApi.reorder,
      onSuccess: () => {
        toast.success("排序成功");
      },
    });

    const handleDelete = (id: string) => {
      data.value = data.value.filter(item => item._id !== id);
      deleteMutation.mutate(id);
    };

    const wrapperRef = ref<HTMLDivElement>();
    let sortable: Sortable | null = null;

    watchOnce(
      () => data.value,
      () => {
        if (data.value.length === 0)
          return;

        requestAnimationFrame(() => {
          if (!wrapperRef.value)
            return;
          sortable = new Sortable(wrapperRef.value, {
            animation: 150,
            handle: ".drag-handle",
            ghostClass: "opacity-50",
            chosenClass: "!bg-neutral-100 dark:!bg-neutral-800",
            onEnd(evt) {
              if (
                typeof evt.oldIndex === "undefined"
                || typeof evt.newIndex === "undefined"
              ) {
                return;
              }
              if (evt.oldIndex === evt.newIndex)
                return;

              const reorderData = reorder(
                data.value,
                evt.oldIndex,
                evt.newIndex,
              );
              data.value = reorderData;

              const seq = [...reorderData]
                .reverse()
                .map((item, idx) => ({ _id: item._id, order: idx + 1 }));
              reorderMutation.mutate(seq);
            },
          });
        });
      },
    );

    onBeforeUnmount(() => sortable?.destroy());

    const { setActions } = useLayout();
    setActions(<HeaderActionButton to="/pages/edit" icon={<AddIcon />} />);

    return () => (
      <div class="border border-neutral-200 rounded-lg bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">
        {isLoading.value
          ? (
              <div class="py-16 flex items-center justify-center">
                <span class="text-sm text-neutral-400">加载中...</span>
              </div>
            )
          : data.value.length === 0
            ? (
                <EmptyState />
              )
            : (
                <div ref={wrapperRef}>
                  {data.value.map(item => (
                    <PageItem data={item} key={item._id} onDelete={handleDelete} />
                  ))}
                </div>
              )}
      </div>
    );
  },
});
