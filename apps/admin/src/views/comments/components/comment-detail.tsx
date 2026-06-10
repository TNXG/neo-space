import type { PropType } from "vue";
import type { CommentModel } from "~/models/comment";
import {
  ArrowLeft as ArrowLeftIcon,
  Check as CheckIcon,
  ChevronRight as ChevronRightIcon,
  SmilePlus as EmojiAddIcon,
  Globe as GlobeIcon,
  Mail as MailIcon,
  MapPin as MapPinIcon,
  Monitor as MonitorIcon,
  Smartphone as PhoneIcon,
  ShieldAlert as SpamIcon,
  Trash2 as TrashIcon,
  CornerDownRight as TurnRightIcon,
} from "lucide-vue-next";
import {
  NAvatar,
  NButton,
  NInput,
  NPopconfirm,
  NPopover,
  NScrollbar,
  NTooltip,
} from "naive-ui";
import { computed, defineComponent, nextTick, ref, unref, watch } from "vue";

import { EmojiPicker } from "~/components/editor/toolbar/emoji-picker";
import { IpInfoPopover } from "~/components/ip-info";
import { RelativeTime } from "~/components/time/relative-time";
import { WEB_URL } from "~/constants/env";
import { CommentState } from "~/models/comment";
import { useUserStore } from "~/stores/user";

import { CommentMarkdownRender } from "../markdown-render";

const getReferenceLink = (row: CommentModel) => {
  switch (row.refType) {
    case "post": {
      return `${WEB_URL}/posts/${row.ref}`;
    }
    case "note": {
      return `${WEB_URL}/notes/${row.ref}`;
    }
    case "page": {
      return `${WEB_URL}/pages/${row.ref}`;
    }
    case "recently": {
      return `${WEB_URL}/thinking/${row.ref}`;
    }
    default:
      return "";
  }
};

interface LocalReply {
  id: string;
  text: string;
  created: Date;
}

export const CommentDetail = defineComponent({
  name: "CommentDetail",
  props: {
    comment: {
      type: Object as PropType<CommentModel>,
      required: true,
    },
    currentTab: {
      type: Number,
      required: true,
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    replyLoading: {
      type: Boolean,
      default: false,
    },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onChangeState: {
      type: Function as PropType<
        (id: string, state: CommentState) => Promise<void> | void
      >,
      required: true,
    },
    onDelete: {
      type: Function as PropType<(id: string) => Promise<void> | void>,
      required: true,
    },
    onReply: {
      type: Function as PropType<(id: string, text: string) => Promise<void>>,
      required: true,
    },
  },
  setup(props) {
    const userStore = useUserStore();
    const user = computed(() => userStore.user);

    const link = computed(() => getReferenceLink(props.comment));
    const isReply = computed(() => !!props.comment.parentCommentId);
    const isTrash = computed(() => props.currentTab === 2);
    const commentBody = computed(() =>
      props.comment.isDeleted ? "该评论已删除" : props.comment.text,
    );
    const parentComment = computed(() => props.comment.parent ?? null);
    const parentCommentBody = computed(() => {
      if (!parentComment.value) {
        return "";
      }
      return parentComment.value.isDeleted
        ? "该评论已删除"
        : parentComment.value.text;
    });

    const deviceInfo = computed(() => {
      const ua = props.comment.agent?.toLowerCase() || "";
      const isMobile
        = ua.includes("mobile") || ua.includes("android") || ua.includes("iphone");
      return {
        icon: isMobile
          ? (
              <PhoneIcon class="h-3.5 w-3.5" />
            )
          : (
              <MonitorIcon class="h-3.5 w-3.5" />
            ),
        label: props.comment.agent?.split(" ")[0] || "未知设备",
        full: props.comment.agent,
      };
    });

    const replyText = ref("");
    const replyInputRef = ref<typeof NInput>();
    const localReplies = ref<LocalReply[]>([]);
    const scrollbarRef = ref<InstanceType<typeof NScrollbar>>();

    const focusInput = () => {
      nextTick(() => {
        if (replyInputRef.value && !isTrash.value) {
          const el = unref(replyInputRef.value);
          el.focus();
        }
      });
    };

    const scrollToBottom = () => {
      nextTick(() => {
        if (scrollbarRef.value) {
          const container = scrollbarRef.value.$el?.querySelector(
            ".n-scrollbar-container",
          ) as HTMLElement;
          if (container) {
            container.scrollTop = container.scrollHeight;
          }
        }
      });
    };

    watch(
      () => props.comment._id,
      () => {
        replyText.value = "";
        localReplies.value = [];
        focusInput();
      },
      { immediate: true },
    );

    const handleReplySubmit = async () => {
      if (!replyText.value.trim())
        return;
      const text = replyText.value;
      replyText.value = "";

      await props.onReply(props.comment._id, text);

      localReplies.value.push({
        id: Date.now().toString(),
        text,
        created: new Date(),
      });

      scrollToBottom();
      focusInput();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleReplySubmit();
        e.preventDefault();
      }
    };

    const noop = () => void 0;

    const ActionButton = (p: {
      icon: any;
      onClick: () => void;
      label: string;
      class?: string;
    }) => (
      <NTooltip>
        {{
          trigger: () => (
            <button
              onClick={p.onClick}
              class={`text-neutral-500 rounded-md flex h-8 w-8 transition-colors items-center justify-center dark:text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 ${p.class || ""}`}
            >
              <p.icon class="h-4 w-4" />
            </button>
          ),
          default: () => p.label,
        }}
      </NTooltip>
    );

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex flex-shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            {props.isMobile && props.onBack && (
              <button
                onClick={props.onBack}
                class="text-neutral-500 rounded-md flex h-8 w-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon class="h-5 w-5" />
              </button>
            )}
            <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              评论详情
            </h2>
          </div>

          <div class="flex gap-1 items-center">
            {props.currentTab !== 1 && (
              <ActionButton
                icon={CheckIcon}
                label="标为已读"
                onClick={() =>
                  props.onChangeState(props.comment._id, CommentState.Read)}
              />
            )}
            {props.currentTab !== 2 && (
              <ActionButton
                icon={SpamIcon}
                label="标为垃圾"
                onClick={() =>
                  props.onChangeState(props.comment._id, CommentState.Junk)}
              />
            )}
            <NPopconfirm
              positiveText="确认删除"
              negativeText="取消"
              onPositiveClick={() => props.onDelete(props.comment._id)}
            >
              {{
                trigger: () => (
                  <div class="inline-block">
                    <ActionButton
                      icon={TrashIcon}
                      label="删除"
                      onClick={noop}
                      class="hover:text-red-600 hover:bg-red-50 dark:hover:text-red-500 dark:hover:bg-red-900/20"
                    />
                  </div>
                ),
                default: () => "确定要删除这条评论吗？",
              }}
            </NPopconfirm>
          </div>
        </div>

        <NScrollbar ref={scrollbarRef} class="flex-1 min-h-0">
          <div class="mx-auto p-6 max-w-3xl space-y-8">
            {isReply.value && (
              <div class="pl-6 relative">
                <div class="bg-neutral-200 h-full w-0.5 left-0 top-0 absolute dark:bg-neutral-800" />
                <div class="text-xs text-neutral-500 mb-2 flex gap-2 items-center">
                  <TurnRightIcon class="h-3 w-3" />
                  <span>
                    回复
                    {parentComment.value
                      ? (
                          <strong class="text-neutral-900 font-medium ml-1 dark:text-neutral-100">
                            @
                            {parentComment.value.author}
                          </strong>
                        )
                      : (
                          <strong class="text-neutral-900 font-medium ml-1 dark:text-neutral-100">
                            上级评论
                          </strong>
                        )}
                  </span>
                </div>
                {parentComment.value
                  ? (
                      <div class="text-sm text-neutral-600 line-clamp-2 dark:text-neutral-400">
                        <CommentMarkdownRender text={parentCommentBody.value} />
                      </div>
                    )
                  : (
                      <div class="text-sm text-neutral-600 dark:text-neutral-400">
                        上级评论 ID:
                        {" "}
                        {String(props.comment.parentCommentId)}
                      </div>
                    )}
              </div>
            )}

            <div class="space-y-4">
              <div class="flex gap-3 items-center">
                <NAvatar
                  round
                  src={props.comment.avatar}
                  size={48}
                  class="bg-neutral-100 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-800"
                />
                <div>
                  <div class="flex gap-2 items-center">
                    <span class="text-neutral-900 font-semibold dark:text-neutral-100">
                      {props.comment.author}
                    </span>
                    {props.comment.isWhispers && (
                      <span class="text-xs text-amber-800 tracking-wider font-medium px-2 py-0.5 rounded-full bg-amber-100 uppercase dark:text-amber-500 dark:bg-amber-900/30">
                        悄悄话
                      </span>
                    )}
                  </div>
                  <div class="text-xs text-neutral-500">
                    <RelativeTime
                      time={props.comment.editedAt ?? props.comment.createdAt}
                    />
                  </div>
                </div>
              </div>

              <div class="text-base text-neutral-900 leading-relaxed max-w-none prose prose-neutral dark:text-neutral-100 dark:prose-invert">
                <CommentMarkdownRender text={commentBody.value} />
              </div>

              {props.comment.ref && (
                <div class="text-sm text-neutral-600 px-3 py-2 border border-neutral-100 rounded-md bg-neutral-50 flex gap-2 transition-colors items-center dark:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                  <span class="text-neutral-400">来源:</span>
                  <a
                    href={link.value}
                    target="_blank"
                    class="font-medium truncate hover:underline"
                    rel="noreferrer"
                  >
                    {props.comment.ref}
                  </a>
                  <ChevronRightIcon class="text-neutral-400 ml-auto h-4 w-4" />
                </div>
              )}
            </div>

            <div class="bg-neutral-100 h-px dark:bg-neutral-800" />

            <div class="gap-4 grid grid-cols-1 lg:grid-cols-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1">
                <span class="text-xs text-neutral-500 font-medium">
                  IP 地址
                </span>
                {props.comment.ip
                  ? (
                      <div class="flex gap-2 items-center">
                        <IpInfoPopover
                          ip={props.comment.ip}
                          trigger="click"
                          triggerEl={(
                            <button class="text-sm text-neutral-900 flex gap-1.5 items-center dark:text-neutral-100 hover:underline">
                              <MapPinIcon class="text-neutral-400 h-3.5 w-3.5" />
                              <span>{props.comment.ip}</span>
                            </button>
                          )}
                        />
                      </div>
                    )
                  : (
                      <span class="text-sm text-neutral-400">未知</span>
                    )}
              </div>

              <div class="flex flex-col gap-1">
                <span class="text-xs text-neutral-500 font-medium">
                  访问设备
                </span>
                {props.comment.agent
                  ? (
                      <NTooltip trigger="hover">
                        {{
                          trigger: () => (
                            <div class="text-sm text-neutral-900 flex gap-1.5 items-center dark:text-neutral-100">
                              <span class="text-neutral-400">
                                {deviceInfo.value.icon}
                              </span>
                              <span class="truncate">{deviceInfo.value.label}</span>
                            </div>
                          ),
                          default: () => deviceInfo.value.full,
                        }}
                      </NTooltip>
                    )
                  : (
                      <span class="text-sm text-neutral-400">未知</span>
                    )}
              </div>

              {props.comment.mail && (
                <div class="flex flex-col gap-1">
                  <span class="text-xs text-neutral-500 font-medium">
                    电子邮箱
                  </span>
                  <a
                    href={`mailto:${props.comment.mail}`}
                    class="text-sm text-neutral-900 flex gap-1.5 items-center dark:text-neutral-100 hover:underline"
                  >
                    <MailIcon class="text-neutral-400 h-3.5 w-3.5" />
                    <span class="truncate">{props.comment.mail}</span>
                  </a>
                </div>
              )}

              {props.comment.url && (
                <div class="flex flex-col gap-1">
                  <span class="text-xs text-neutral-500 font-medium">
                    站点地址
                  </span>
                  <a
                    href={props.comment.url}
                    target="_blank"
                    class="text-sm text-neutral-900 flex gap-1.5 items-center dark:text-neutral-100 hover:underline"
                    rel="noreferrer"
                  >
                    <GlobeIcon class="text-neutral-400 h-3.5 w-3.5" />
                    <span class="truncate">{props.comment.url}</span>
                  </a>
                </div>
              )}
            </div>

            {localReplies.value.length > 0 && (
              <div class="mt-8 pt-8 border-t border-neutral-100 space-y-6 dark:border-neutral-800">
                <h3 class="text-xs text-neutral-500 tracking-wider font-medium uppercase">
                  新增回复
                </h3>
                {localReplies.value.map(reply => (
                  <div key={reply.id} class="flex gap-4">
                    <NAvatar
                      round
                      src={user.value?.avatar}
                      size={32}
                      class="bg-neutral-100 shrink-0 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:ring-neutral-800"
                    />
                    <div class="flex-1 min-w-0 space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
                          {user.value?.name || "我"}
                        </span>
                        <span class="text-xs text-neutral-400">
                          <RelativeTime time={reply.created.toISOString()} />
                        </span>
                      </div>
                      <div class="prose prose-neutral prose-sm dark:prose-invert">
                        <CommentMarkdownRender text={reply.text} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </NScrollbar>

        {!isTrash.value && (
          <div class="p-4 border-t border-neutral-200 bg-white flex-shrink-0 dark:border-neutral-800 dark:bg-neutral-900">
            <div class="mx-auto max-w-3xl">
              <div class="border border-neutral-200 rounded-lg bg-white shadow-sm relative overflow-hidden dark:border-neutral-800 focus-within:border-neutral-400 dark:bg-neutral-900 focus-within:ring-1 focus-within:ring-neutral-400 dark:focus-within:border-neutral-700 dark:focus-within:ring-neutral-700">
                <NInput
                  ref={replyInputRef}
                  value={replyText.value}
                  type="textarea"
                  placeholder="写下你的回复..."
                  onInput={v => (replyText.value = v)}
                  autosize={{ minRows: 2, maxRows: 8 }}
                  onKeydown={handleKeyDown}
                  bordered={false}
                  class="bg-transparent !bg-transparent"
                />
                <div class="px-2 py-1.5 border-t border-neutral-100 bg-neutral-50 flex items-center justify-between dark:border-neutral-800 dark:bg-neutral-900/50">
                  <NPopover
                    internalExtraClass={["headless"]}
                    trigger="click"
                    placement="top-start"
                    showArrow={false}
                  >
                    {{
                      trigger: () => (
                        <button class="text-neutral-400 p-1.5 rounded transition-colors hover:text-neutral-600 hover:bg-neutral-200 dark:hover:text-neutral-300 dark:hover:bg-neutral-800">
                          <EmojiAddIcon class="h-4 w-4" />
                        </button>
                      ),
                      default: () => (
                        <EmojiPicker
                          onSelect={(emoji) => {
                            if (!replyInputRef.value)
                              return;
                            const el = unref(replyInputRef.value)
                              .textareaElRef as HTMLTextAreaElement;
                            const start = el.selectionStart;
                            const text = replyText.value;
                            replyText.value = `${text.slice(0, start)}${emoji}${text.slice(el.selectionEnd)}`;
                            nextTick(() => {
                              el.focus();
                              el.setSelectionRange(
                                start + emoji.length,
                                start + emoji.length,
                              );
                            });
                          }}
                        />
                      ),
                    }}
                  </NPopover>

                  <div class="flex gap-3 items-center">
                    <span class="text-xs text-neutral-400 hidden sm:inline-block">
                      使用
                      {" "}
                      <kbd class="font-sans">⌘</kbd>
                      {" "}
                      +
                      {" "}
                      <kbd class="font-sans">Enter</kbd>
                      {" "}
                      发送
                    </span>
                    <NButton
                      type="primary"
                      size="tiny"
                      onClick={handleReplySubmit}
                      loading={props.replyLoading}
                      disabled={!replyText.value.trim()}
                      class="px-2"
                    >
                      发送回复
                    </NButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
});
