import type { PropType } from "vue";
import type { SayModel } from "~/models/say";
import { Pencil, Quote, Trash2, User, X } from "lucide-vue-next";
import { NButton, NInput, NModal, NPopconfirm } from "naive-ui";
import { computed, defineComponent, reactive, ref, watch } from "vue";
import { toast } from "vue-sonner";

import { saysApi } from "~/api/says";
import { RelativeTime } from "~/components/time/relative-time";

export type SayWithMeta = SayModel;

export const SayListItem = defineComponent({
  name: "SayListItem",
  props: {
    say: {
      type: Object as PropType<SayWithMeta>,
      required: true,
    },
    onEdit: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="group px-4 py-4 border-b border-neutral-200 transition-colors last:border-b-0 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
        <div class="flex gap-3">
          <div class="pt-0.5 shrink-0">
            <Quote
              class="text-neutral-300 size-5 dark:text-neutral-600"
              aria-hidden="true"
            />
          </div>

          <div class="flex-1 min-w-0">
            <p class="text-base text-neutral-800 leading-relaxed dark:text-neutral-200">
              {props.say.text}
            </p>

            <div class="text-sm text-neutral-500 mt-2 flex flex-wrap gap-x-4 gap-y-1 items-center dark:text-neutral-400">
              {props.say.author && (
                <span class="flex gap-1 items-center">
                  <User class="size-3.5" aria-hidden="true" />
                  {props.say.author}
                </span>
              )}
              {props.say.source && (
                <span class="text-neutral-400 dark:text-neutral-500">
                  ——
                  {" "}
                  {props.say.source}
                </span>
              )}
              {props.say.createdAt && (
                <RelativeTime
                  time={props.say.createdAt}
                  class="text-neutral-400 dark:text-neutral-500"
                />
              )}
            </div>
          </div>

          <div class="opacity-0 flex shrink-0 gap-1 transition-opacity items-start group-hover:opacity-100">
            <NButton
              size="tiny"
              quaternary
              type="primary"
              onClick={props.onEdit}
              aria-label="编辑一言"
            >
              {{
                icon: () => <Pencil class="size-3.5" />,
                default: () => <span class="hidden sm:inline">编辑</span>,
              }}
            </NButton>

            <NPopconfirm onPositiveClick={() => props.onDelete(props.say.id!)}>
              {{
                trigger: () => (
                  <NButton
                    size="tiny"
                    quaternary
                    type="error"
                    aria-label="删除一言"
                  >
                    <Trash2 class="size-3.5" />
                  </NButton>
                ),
                default: () => (
                  <span class="max-w-64 break-all">
                    确定要删除「
                    {props.say.text.slice(0, 30)}
                    {props.say.text.length > 30 ? "…" : ""}
                    」吗？
                  </span>
                ),
              }}
            </NPopconfirm>
          </div>
        </div>
      </div>
    );
  },
});

export const SayEditModal = defineComponent({
  name: "SayEditModal",
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    say: {
      type: Object as PropType<SayWithMeta | null>,
      default: null,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onSuccess: {
      type: Function as PropType<(say: SayWithMeta) => void>,
      required: true,
    },
  },
  setup(props) {
    const form = reactive({
      text: "",
      author: "",
      source: "",
    });
    const submitting = ref(false);
    const textError = ref("");

    watch(
      () => [props.show, props.say],
      ([show, say]) => {
        if (show) {
          if (say) {
            form.text = (say as SayWithMeta).text || "";
            form.author = (say as SayWithMeta).author || "";
            form.source = (say as SayWithMeta).source || "";
          } else {
            form.text = "";
            form.author = "";
            form.source = "";
          }
          textError.value = "";
        }
      },
      { immediate: true },
    );

    const isEdit = computed(() => !!props.say?.id);

    const handleSubmit = async () => {
      // 验证
      if (!form.text.trim()) {
        textError.value = "请输入内容";
        return;
      }
      textError.value = "";

      submitting.value = true;
      try {
        let result: SayWithMeta;
        const data = {
          text: form.text.trim(),
          author: form.author.trim() || undefined,
          source: form.source.trim() || undefined,
        };

        if (isEdit.value) {
          result = await saysApi.update(props.say!.id!, data);
          toast.success("修改成功");
        } else {
          result = await saysApi.create(data);
          toast.success("发布成功");
        }

        props.onSuccess(result);
      } finally {
        submitting.value = false;
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
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
          class="rounded-xl bg-white max-w-lg w-full shadow-xl dark:bg-neutral-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="say-modal-title"
          onKeydown={handleKeydown}
        >
          <div class="px-5 py-4 border-b border-neutral-200 flex items-center justify-between dark:border-neutral-800">
            <h2
              id="say-modal-title"
              class="text-lg text-neutral-900 font-semibold dark:text-neutral-100"
            >
              {isEdit.value ? "编辑一言" : "添加一言"}
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

          <div class="px-5 py-4">
            <div class="mb-4">
              <label class="text-sm text-neutral-700 font-medium mb-1.5 block dark:text-neutral-300">
                内容
                {" "}
                <span class="text-red-500">*</span>
              </label>
              <NInput
                type="textarea"
                value={form.text}
                onUpdateValue={v => (form.text = v)}
                placeholder="记录一句有意思的话…"
                autosize={{ minRows: 3, maxRows: 8 }}
                status={textError.value ? "error" : undefined}
              />
              {textError.value && (
                <p class="text-xs text-red-500 mt-1">{textError.value}</p>
              )}
            </div>

            <div class="mb-4">
              <label class="text-sm text-neutral-700 font-medium mb-1.5 block dark:text-neutral-300">
                作者
              </label>
              <NInput
                value={form.author}
                onUpdateValue={v => (form.author = v)}
                placeholder="谁说的？"
              />
            </div>

            <div class="mb-4">
              <label class="text-sm text-neutral-700 font-medium mb-1.5 block dark:text-neutral-300">
                来源
              </label>
              <NInput
                value={form.source}
                onUpdateValue={v => (form.source = v)}
                placeholder="出自哪里？"
              />
            </div>
          </div>

          <div class="px-5 py-4 border-t border-neutral-200 flex gap-2 items-center justify-end dark:border-neutral-800">
            <span class="text-xs text-neutral-400 mr-auto">
              Cmd/Ctrl + Enter 快速保存
            </span>
            <NButton onClick={props.onClose}>取消</NButton>
            <NButton
              type="primary"
              loading={submitting.value}
              onClick={handleSubmit}
            >
              {isEdit.value ? "保存" : "发布"}
            </NButton>
          </div>
        </div>
      </NModal>
    );
  },
});

export const SayEmptyState = defineComponent({
  name: "SayEmptyState",
  props: {
    onCreate: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="py-16 border-2 border-neutral-200 rounded-xl border-dashed bg-neutral-50/50 flex flex-col items-center justify-center dark:border-neutral-800 dark:bg-neutral-900/50">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <Quote class="text-neutral-400 size-8" aria-hidden="true" />
        </div>
        <h3 class="text-lg text-neutral-900 font-medium mb-1 dark:text-neutral-100">
          暂无一言
        </h3>
        <p class="text-sm text-neutral-500 mb-6 dark:text-neutral-400">
          记录一些有意思的话语吧
        </p>
        <NButton type="primary" onClick={props.onCreate}>
          添加第一条一言
        </NButton>
      </div>
    );
  },
});

export const SayListSkeleton = defineComponent({
  name: "SayListSkeleton",
  setup() {
    return () => (
      <div class="animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            class="px-4 py-4 border-b border-neutral-200 flex gap-3 last:border-b-0 dark:border-neutral-800"
          >
            <div class="rounded bg-neutral-200 size-5 dark:bg-neutral-700" />
            <div class="flex-1">
              <div class="rounded bg-neutral-200 h-5 w-full dark:bg-neutral-700" />
              <div class="mt-2 rounded bg-neutral-100 h-5 w-3/4 dark:bg-neutral-800" />
              <div class="mt-3 flex gap-4">
                <div class="rounded bg-neutral-100 h-4 w-20 dark:bg-neutral-800" />
                <div class="rounded bg-neutral-100 h-4 w-24 dark:bg-neutral-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },
});
