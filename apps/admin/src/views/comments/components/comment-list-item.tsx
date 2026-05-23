import type { PropType } from "vue";
import type { CommentModel } from "~/models/comment";
import { NAvatar, NCheckbox } from "naive-ui";
import { computed, defineComponent } from "vue";

import { RelativeTime } from "~/components/time/relative-time";

export const CommentListItem = defineComponent({
  name: "CommentListItem",
  props: {
    data: {
      type: Object as PropType<CommentModel>,
      required: true,
    },
    checked: {
      type: Boolean,
      default: false,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    onCheck: {
      type: Function as PropType<(checked: boolean) => void>,
      required: true,
    },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const comment = computed(() => props.data);
    const isReply = computed(() => !!comment.value.parentCommentId);
    const previewText = computed(() =>
      comment.value.isDeleted ? "该评论已删除" : comment.value.text,
    );

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest(".n-checkbox")) {
        return;
      }
      props.onSelect();
    };

    const handleCheckboxClick = (e: MouseEvent) => {
      e.stopPropagation();
    };

    return () => (
      <div
        class={[
          "flex cursor-pointer items-start gap-2.5 px-4 py-3 transition-colors",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : props.checked
              ? "bg-neutral-50 dark:bg-neutral-800/50"
              : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        ]}
        onClick={handleClick}
      >
        <div class="mt-0.5 shrink-0" onClick={handleCheckboxClick}>
          <NCheckbox
            checked={props.checked}
            onUpdateChecked={props.onCheck}
            size="small"
          />
        </div>

        <NAvatar
          circle
          src={comment.value.avatar}
          size={32}
          class="mt-0.5 bg-neutral-100 shrink-0 dark:bg-neutral-800"
        />

        <div class="flex-1 min-w-0">
          <div class="flex gap-1.5 items-baseline">
            <span class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
              {comment.value.author}
            </span>
            {isReply.value && (
              <span class="text-xs text-neutral-400 shrink-0">回复</span>
            )}
            <span class="text-xs text-neutral-400 ml-auto shrink-0">
              <RelativeTime time={comment.value.createdAt} />
            </span>
          </div>
          <p class="text-sm text-neutral-600 mt-0.5 line-clamp-2 dark:text-neutral-400">
            {previewText.value}
          </p>
          {comment.value.isWhispers && (
            <span class="text-xs text-yellow-800 font-medium mt-1 px-1.5 py-0.5 rounded-full bg-yellow-100 inline-flex items-center dark:text-yellow-500 dark:bg-yellow-900/30">
              悄悄话
            </span>
          )}
        </div>
      </div>
    );
  },
});
