import type { PropType } from "vue";
import type { SessionMeta } from "./composables/use-session-manager";
import { ChevronDown, Plus, RefreshCw, Trash2 } from "lucide-vue-next";
import { NPopconfirm, NPopover, NSpin } from "naive-ui";
import { computed, defineComponent, ref } from "vue";

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)
    return "刚刚";
  if (minutes < 60)
    return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

export const SessionHeader = defineComponent({
  name: "SessionHeader",
  props: {
    sessions: {
      type: Array as PropType<SessionMeta[]>,
      required: true,
    },
    activeSessionId: {
      type: String as PropType<string | null>,
      default: null,
    },
    isLoading: {
      type: Boolean,
      default: false,
    },
    loadError: {
      type: Boolean,
      default: false,
    },
  },
  emits: [
    "switchSession",
    "createSession",
    "deleteSession",
    "renameSession",
    "retry",
  ],
  setup(props, { emit }) {
    const dropdownVisible = ref(false);
    const isEditing = ref(false);
    const editValue = ref("");

    const activeSession = computed(() =>
      props.sessions.find(s => s.id === props.activeSessionId),
    );

    const displayTitle = computed(
      () => activeSession.value?.title || "未命名对话",
    );

    const sortedSessions = computed(() =>
      [...props.sessions].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    );

    function handleStartEdit() {
      isEditing.value = true;
      editValue.value = activeSession.value?.title || "";
    }

    function handleFinishEdit() {
      isEditing.value = false;
      const trimmed = editValue.value.trim();
      if (trimmed && props.activeSessionId) {
        emit("renameSession", props.activeSessionId, trimmed);
      }
    }

    function handleEditKeydown(e: KeyboardEvent) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleFinishEdit();
      }
      if (e.key === "Escape") {
        isEditing.value = false;
      }
    }

    function handleSelectSession(id: string) {
      dropdownVisible.value = false;
      if (id !== props.activeSessionId) {
        emit("switchSession", id);
      }
    }

    return () => (
      <div class="px-3 border-b border-neutral-200 flex flex-shrink-0 h-9 items-center justify-between dark:border-neutral-700">
        {props.loadError
          ? (
              <button
                class="text-xs text-red-500 flex flex-1 gap-1.5 cursor-pointer items-center"
                onClick={() => emit("retry")}
              >
                <RefreshCw class="h-3 w-3" />
                加载失败，点击重试
              </button>
            )
          : (
              <>
                <div class="flex flex-1 gap-1 min-w-0 items-center">
                  {isEditing.value
                    ? (
                        <input
                          class="text-xs text-neutral-800 font-semibold px-1.5 outline-none border border-neutral-300 rounded bg-transparent flex-1 h-6 min-w-0 dark:text-neutral-200 dark:border-neutral-600 focus:border-blue-400"
                          value={editValue.value}
                          onInput={(e) => {
                            editValue.value = (e.target as HTMLInputElement).value;
                          }}
                          onBlur={handleFinishEdit}
                          onKeydown={handleEditKeydown}
                          autofocus
                        />
                      )
                    : (
                        <NPopover
                          trigger="click"
                          placement="bottom-start"
                          show={dropdownVisible.value}
                          onUpdateShow={(v: boolean) => {
                            dropdownVisible.value = v;
                          }}
                          raw
                          style={{ padding: 0 }}
                        >
                          {{
                            trigger: () => (
                              <button
                                class="text-xs text-neutral-700 font-semibold px-1.5 py-0.5 rounded flex gap-1 min-w-0 cursor-pointer transition-colors items-center dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                onDblclick={handleStartEdit}
                              >
                                <span class="truncate">{displayTitle.value}</span>
                                <ChevronDown class="opacity-50 flex-shrink-0 h-3 w-3" />
                              </button>
                            ),
                            default: () => (
                              <div class="border border-neutral-200 rounded-lg bg-white w-64 shadow-lg overflow-hidden dark:border-neutral-700 dark:bg-neutral-900">
                                {props.isLoading
                                  ? (
                                      <div class="py-6 flex items-center justify-center">
                                        <NSpin size="small" />
                                      </div>
                                    )
                                  : sortedSessions.value.length === 0
                                    ? (
                                        <div class="text-xs text-neutral-400 px-3 py-4 text-center">
                                          暂无历史对话
                                        </div>
                                      )
                                    : (
                                        <div class="py-1 max-h-64 overflow-y-auto">
                                          {sortedSessions.value.map(session => (
                                            <button
                                              key={session.id}
                                              class={[
                                                "flex w-full cursor-pointer flex-col gap-0.5 px-3 py-2 text-left transition-colors",
                                                session.id === props.activeSessionId
                                                  ? "bg-neutral-100 dark:bg-neutral-800"
                                                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                                              ]}
                                              onClick={() => handleSelectSession(session.id)}
                                            >
                                              <span class="text-xs text-neutral-800 font-medium truncate dark:text-neutral-200">
                                                {session.title || "未命名对话"}
                                              </span>
                                              <span class="text-xs text-neutral-400">
                                                {formatRelativeTime(session.updatedAt)}
                                                {" · "}
                                                {session.messageCount}
                                                {" "}
                                                条消息
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                              </div>
                            ),
                          }}
                        </NPopover>
                      )}
                </div>

                <div class="flex gap-0.5 items-center">
                  <button
                    class="text-neutral-500 rounded inline-flex h-6 w-6 cursor-pointer transition-colors items-center justify-center hover:text-neutral-700 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800"
                    title="新建对话"
                    onClick={() => emit("createSession")}
                  >
                    <Plus class="h-3.5 w-3.5" />
                  </button>

                  {props.activeSessionId && (
                    <NPopconfirm
                      onPositiveClick={() => {
                        if (props.activeSessionId) {
                          emit("deleteSession", props.activeSessionId);
                        }
                      }}
                    >
                      {{
                        trigger: () => (
                          <button
                            class="text-neutral-500 rounded inline-flex h-6 w-6 cursor-pointer transition-colors items-center justify-center hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-950/20"
                            title="删除对话"
                          >
                            <Trash2 class="h-3.5 w-3.5" />
                          </button>
                        ),
                        default: () => "确定删除这个对话吗？",
                      }}
                    </NPopconfirm>
                  )}
                </div>
              </>
            )}
      </div>
    );
  },
});
