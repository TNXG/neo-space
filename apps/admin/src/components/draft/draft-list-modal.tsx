import type { PropType } from "vue";
import type { DraftModel } from "~/models/draft";
import { X } from "lucide-vue-next";
import { NButton, NCheckbox, NModal } from "naive-ui";
import { defineComponent, ref, watch } from "vue";

import { FilePreview } from "./file-preview";

export const DraftListModal = defineComponent({
  name: "DraftListModal",
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
    drafts: {
      type: Array as PropType<DraftModel[]>,
      required: true,
    },
    draftLabel: {
      type: String,
      default: "内容",
    },
    onSelect: {
      type: Function as PropType<(draftId: string) => void>,
      required: true,
    },
    onCreate: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const selectedDraftId = ref<string | null>(null);
    const selectedDraft = ref<DraftModel | null>(null);

    // Default select first draft
    watch(
      () => props.show,
      (show) => {
        if (show && props.drafts.length > 0) {
          selectedDraftId.value = props.drafts[0]._id;
          selectedDraft.value = props.drafts[0];
        }
      },
      { immediate: true },
    );

    const handleSelectDraft = (draft: DraftModel) => {
      selectedDraftId.value = draft._id;
      selectedDraft.value = draft;
    };

    const handleCreate = () => {
      props.onCreate();
      props.onClose();
    };

    const handleContinue = () => {
      if (selectedDraftId.value) {
        props.onSelect(selectedDraftId.value);
        props.onClose();
      }
    };

    const formatWordCount = (text: string) => {
      return text.length;
    };

    return () => (
      <NModal
        show={props.show}
        onUpdateShow={(show) => {
          if (!show)
            props.onClose();
        }}
        closeOnEsc
        transformOrigin="center"
      >
        <div
          class="rounded-xl bg-white flex flex-col h-[600px] max-w-[90vw] w-[900px] shadow-xl dark:bg-neutral-900"
          role="dialog"
          aria-modal="true"
        >
          {/* Header */}
          <div class="px-5 py-4 border-b border-neutral-200 flex flex-shrink-0 items-center justify-between dark:border-neutral-800">
            <h2 class="text-lg text-neutral-900 font-semibold dark:text-neutral-100">
              发现未完成的草稿
            </h2>
            <button
              type="button"
              class="text-neutral-400 p-1 rounded-lg transition-colors hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={props.onClose}
              aria-label="关闭"
            >
              <X class="size-5" />
            </button>
          </div>

          {/* Body - Split View */}
          <div class="flex flex-1 min-h-0">
            {/* Left: Draft List */}
            <div class="border-r border-neutral-200 flex-shrink-0 w-60 overflow-y-auto dark:border-neutral-800">
              {props.drafts.map((draft, index) => (
                <div
                  key={draft._id}
                  class={[
                    "cursor-pointer px-4 py-3 transition-colors",
                    selectedDraftId.value === draft._id
                      ? "bg-neutral-100 dark:bg-neutral-800"
                      : "hover:bg-neutral-50 dark:hover:bg-neutral-800/50",
                    index !== props.drafts.length - 1
                    && "border-b border-neutral-100 dark:border-neutral-800",
                  ]}
                  onClick={() => handleSelectDraft(draft)}
                >
                  <div class="flex gap-3 items-start">
                    <div class="mt-0.5 flex-shrink-0">
                      <NCheckbox
                        checked={selectedDraftId.value === draft._id}
                        onUpdateChecked={() => handleSelectDraft(draft)}
                      />
                    </div>

                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
                        {draft.title || "无标题"}
                      </p>
                      <p class="text-xs text-neutral-400 mt-1 dark:text-neutral-500">
                        v
                        {draft.version}
                        {" "}
                        ·
                        {" "}
                        {formatWordCount(draft.text)}
                        {" "}
                        字
                      </p>
                      <p class="text-xs text-neutral-400 mt-0.5 dark:text-neutral-500">
                        {new Date(draft.updatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: Content Preview */}
            <div class="flex-1 min-w-0">
              {selectedDraft.value
                ? (
                    <FilePreview
                      file={{
                        name: `${selectedDraft.value.title || "draft"}.md`,
                        contents: selectedDraft.value.text,
                      }}
                    />
                  )
                : (
                    <div class="text-neutral-400 flex h-full items-center justify-center">
                      选择一个草稿查看内容
                    </div>
                  )}
            </div>
          </div>

          {/* Footer */}
          <div class="px-5 py-4 border-t border-neutral-200 flex flex-shrink-0 gap-2 items-center justify-end dark:border-neutral-800">
            <NButton onClick={handleCreate}>
              创建新
              {props.draftLabel}
            </NButton>
            <NButton
              type="primary"
              onClick={handleContinue}
              disabled={!selectedDraftId.value}
            >
              继续编辑选中的草稿
            </NButton>
          </div>
        </div>
      </NModal>
    );
  },
});
