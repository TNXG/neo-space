import type { PropType } from "vue";
import type { ProjectModel } from "~/models/project";
import { ExternalLink, Folder, Inbox as InboxIcon } from "lucide-vue-next";
import { NAvatar, NScrollbar } from "naive-ui";
import { computed, defineComponent } from "vue";

import { RelativeTime } from "~/components/time/relative-time";
import { textToBigCharOrWord } from "~/utils/word";

interface Pager {
  currentPage: number;
  totalPage: number;
  total: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export const ProjectList = defineComponent({
  name: "ProjectList",
  props: {
    data: {
      type: Array as PropType<ProjectModel[]>,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    pager: {
      type: Object as PropType<Pager | null>,
      default: null,
    },
    onSelect: {
      type: Function as PropType<(project: ProjectModel) => void>,
      required: true,
    },
    onPageChange: {
      type: Function as PropType<(page: number) => void>,
    },
  },
  setup(props) {
    const totalCount = computed(() => props.pager?.total ?? props.data.length);

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex h-12 items-center justify-between dark:border-neutral-800">
          <span class="text-base text-neutral-900 font-semibold flex gap-1.5 items-center dark:text-neutral-100">
            <Folder class="h-4 w-4" />
            项目列表
          </span>
          {totalCount.value > 0 && (
            <span class="text-xs text-neutral-400">
              {totalCount.value}
              {" "}
              个
            </span>
          )}
        </div>

        <div class="flex-1 min-h-0">
          {props.loading && props.data.length === 0
            ? (
                <div class="py-24 flex items-center justify-center">
                  <div class="border-2 border-neutral-300 border-t-neutral-900 rounded-full h-6 w-6 animate-spin dark:border-neutral-700 dark:border-t-white" />
                </div>
              )
            : props.data.length === 0
              ? (
                  <div class="py-24 text-center flex flex-col items-center justify-center">
                    <InboxIcon class="text-neutral-300 mb-4 h-10 w-10 dark:text-neutral-700" />
                    <p class="text-sm text-neutral-500">暂无项目</p>
                    <p class="text-xs text-neutral-400 mt-1">
                      点击右上角按钮创建项目
                    </p>
                  </div>
                )
              : (
                  <NScrollbar class="h-full">
                    <div>
                      {props.data.map(item => (
                        <ProjectListItem
                          key={item.id}
                          data={item}
                          selected={props.selectedId === item.id}
                          onSelect={() => props.onSelect(item)}
                        />
                      ))}
                    </div>
                  </NScrollbar>
                )}
        </div>
      </div>
    );
  },
});

const ProjectListItem = defineComponent({
  name: "ProjectListItem",
  props: {
    data: {
      type: Object as PropType<ProjectModel>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div
        class={[
          "flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3 transition-colors last:border-b-0 dark:border-neutral-800/50",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        ]}
        onClick={props.onSelect}
      >
        <div class="shrink-0">
          {props.data.avatar
            ? (
                <NAvatar
                  round
                  size={40}
                  src={props.data.avatar}
                  fallbackSrc=""
                  class="ring-1 ring-neutral-200 dark:ring-neutral-700"
                />
              )
            : (
                <div class="text-sm text-neutral-600 font-semibold rounded-full flex size-10 uppercase ring-1 ring-neutral-200 items-center justify-center from-neutral-100 to-neutral-200 bg-gradient-to-br dark:text-neutral-300 dark:ring-neutral-700 dark:from-neutral-800 dark:to-neutral-700">
                  {textToBigCharOrWord(props.data.name)}
                </div>
              )}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex gap-2 items-center">
            <h3 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
              {props.data.name}
            </h3>
            {props.data.projectUrl && (
              <ExternalLink class="text-neutral-400 shrink-0 h-3 w-3" />
            )}
          </div>
          {props.data.description && (
            <p class="text-xs text-neutral-500 mt-0.5 truncate dark:text-neutral-400">
              {props.data.description}
            </p>
          )}
          <div class="text-xs text-neutral-400 mt-1">
            <RelativeTime time={props.data.createdAt} />
          </div>
        </div>
      </div>
    );
  },
});
