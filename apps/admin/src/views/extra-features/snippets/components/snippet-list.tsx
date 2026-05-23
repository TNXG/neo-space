import type { PropType } from "vue";
import type { SnippetModel } from "../../../../models/snippet";
import type { GroupWithSnippets } from "../composables/use-snippet-list";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus as PlusIcon,
  Search as SearchIcon,
} from "lucide-vue-next";
import { NInput, NScrollbar, NSpin } from "naive-ui";
import { computed, defineComponent, ref } from "vue";

import { SnippetCard } from "./snippet-card";

export const SnippetList = defineComponent({
  name: "SnippetList",
  props: {
    groups: {
      type: Array as PropType<GroupWithSnippets[]>,
      required: true,
    },
    selectedId: {
      type: String as PropType<string | null>,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    onSelect: {
      type: Function as PropType<(snippet: SnippetModel) => void>,
    },
    onDelete: {
      type: Function as PropType<(snippet: SnippetModel) => void>,
    },
    onToggleGroup: {
      type: Function as PropType<(reference: string) => void>,
    },
    onCreate: {
      type: Function as PropType<() => void>,
    },
  },
  setup(props) {
    const searchQuery = ref("");

    const filteredGroups = computed(() => {
      if (!searchQuery.value.trim()) {
        return props.groups;
      }

      const query = searchQuery.value.toLowerCase();
      return props.groups
        .map(group => ({
          ...group,
          snippets: group.snippets.filter(
            s =>
              s.name.toLowerCase().includes(query)
              || s.comment?.toLowerCase().includes(query),
          ),
          // Force expanded when searching
          expanded: true,
        }))
        .filter(
          group =>
            group.snippets.length > 0
            || group.reference.toLowerCase().includes(query),
        );
    });

    const handleGroupClick = (reference: string) => {
      if (!searchQuery.value.trim()) {
        props.onToggleGroup?.(reference);
      }
    };

    return () => (
      <div class="flex flex-col h-full">
        <div class="p-2 border-b border-neutral-200 flex flex-shrink-0 gap-2 h-12 items-center dark:border-neutral-800">
          <NInput
            v-model:value={searchQuery.value}
            placeholder="搜索…"
            clearable
            size="small"
            class="flex-1"
          >
            {{
              prefix: () => <SearchIcon class="text-neutral-400 size-3.5" />,
            }}
          </NInput>
          <button
            class="text-white rounded-md bg-neutral-900 flex flex-shrink-0 size-7 transition-colors items-center justify-center dark:text-neutral-900 dark:bg-white hover:bg-neutral-700 dark:hover:bg-neutral-200"
            onClick={() => props.onCreate?.()}
            title="新建片段"
          >
            <PlusIcon class="size-4" />
          </button>
        </div>

        <div class="flex-1 min-h-0">
          {props.loading
            ? (
                <div class="flex h-full items-center justify-center">
                  <NSpin size="small" />
                </div>
              )
            : filteredGroups.value.length === 0
              ? (
                  <div class="text-sm text-neutral-400 flex h-full items-center justify-center">
                    {searchQuery.value ? "没有匹配结果" : "暂无分组"}
                  </div>
                )
              : (
                  <NScrollbar class="h-full">
                    {filteredGroups.value.map(group => (
                      <div key={group.reference}>
                        <div
                          class={[
                            "flex cursor-pointer select-none items-center gap-1 px-2 py-1.5",
                            "text-sm text-neutral-600 dark:text-neutral-400",
                            "hover:bg-neutral-100 dark:hover:bg-neutral-800/50",
                          ]}
                          onClick={() => handleGroupClick(group.reference)}
                        >
                          <span class="flex size-4 items-center justify-center">
                            {group.expanded
                              ? (
                                  <ChevronDown class="size-3.5" />
                                )
                              : (
                                  <ChevronRight class="size-3.5" />
                                )}
                          </span>

                          {group.expanded
                            ? (
                                <FolderOpen class="text-amber-500 size-4" />
                              )
                            : (
                                <Folder class="text-amber-500 size-4" />
                              )}

                          <span class="font-medium flex-1 truncate">
                            {group.reference}
                          </span>

                          <span class="text-xs px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700">
                            {group.count}
                          </span>
                        </div>

                        {group.expanded && (
                          <div class="pl-4">
                            {group.loading
                              ? (
                                  <div class="py-4 flex items-center justify-center">
                                    <NSpin size="small" />
                                  </div>
                                )
                              : group.snippets.length === 0
                                ? (
                                    <div class="text-xs text-neutral-400 py-2 pl-6">
                                      暂无片段
                                    </div>
                                  )
                                : (
                                    group.snippets.map(snippet => (
                                      <SnippetCard
                                        key={snippet.id}
                                        snippet={snippet}
                                        selected={snippet.id === props.selectedId}
                                        onSelect={props.onSelect}
                                        onDelete={props.onDelete}
                                        compact
                                      />
                                    ))
                                  )}
                          </div>
                        )}
                      </div>
                    ))}
                  </NScrollbar>
                )}
        </div>
      </div>
    );
  },
});
