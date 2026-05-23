import type { PropType } from "vue";
import type { TopicModel } from "~/models/topic";
import { useMutation } from "@tanstack/vue-query";
import { Upload as UploadIcon, X } from "lucide-vue-next";
import { NButton, NInput, NModal, NSpin } from "naive-ui";
import { defineComponent, nextTick, reactive, ref, watch } from "vue";

import { toast } from "vue-sonner";

import { topicsApi } from "~/api/topics";
import { UploadWrapper } from "~/components/upload";

const FormField = defineComponent({
  props: {
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    error: { type: String, required: false },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-4">
        <label class="text-sm text-neutral-700 font-medium mb-1.5 block dark:text-neutral-300">
          {props.label}
          {props.required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
        {slots.default?.()}
        {props.error && (
          <p class="text-xs text-red-500 mt-1" role="alert">
            {props.error}
          </p>
        )}
      </div>
    );
  },
});

export const TopicEditModal = defineComponent({
  name: "TopicEditModal",
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
    id: {
      type: String,
      required: false,
    },
    onSubmit: {
      type: Function as PropType<(topic: TopicModel) => void>,
      required: false,
    },
  },
  setup(props) {
    const topic = reactive<Partial<TopicModel>>({});
    const loading = ref(false);
    const submitting = ref(false);
    const errors = reactive<Record<string, string>>({});

    const resetTopicData = () => {
      Object.keys(topic).forEach((key) => {
        delete topic[key as keyof typeof topic];
      });
      Object.keys(errors).forEach((key) => {
        delete errors[key];
      });
    };

    const validateForm = (): boolean => {
      Object.keys(errors).forEach(key => delete errors[key]);

      if (!topic.name?.trim()) {
        errors.name = "请输入专栏名称";
      } else if (topic.name.length > 50) {
        errors.name = "名称不能超过 50 个字符";
      }

      if (!topic.slug?.trim()) {
        errors.slug = "请输入专栏 ID";
      } else if (!/^[\w-]+$/.test(topic.slug)) {
        errors.slug = "ID 只能包含字母、数字、下划线和连字符";
      }

      if (!topic.introduce?.trim()) {
        errors.introduce = "请输入简介";
      } else if (topic.introduce.length > 100) {
        errors.introduce = "简介不能超过 100 个字符";
      }

      if (topic.description && topic.description.length > 500) {
        errors.description = "描述不能超过 500 个字符";
      }

      return Object.keys(errors).length === 0;
    };

    watch(
      () => props.id,
      (id) => {
        if (!id) {
          resetTopicData();
        } else {
          loading.value = true;
          topicsApi
            .getById(id)
            .then((data) => {
              Object.assign(topic, data);
            })
            .finally(() => {
              loading.value = false;
            });
        }
      },
    );

    const handleClose = () => {
      props.onClose();
      nextTick(() => resetTopicData());
    };

    const createMutation = useMutation({
      mutationFn: (data: Partial<TopicModel>) => topicsApi.create(data as any),
      onSuccess: (data) => {
        toast.success("创建成功");
        props.onSubmit?.(data);
        resetTopicData();
      },
    });

    const updateMutation = useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<TopicModel> }) =>
        topicsApi.update(id, data as any),
      onSuccess: (data) => {
        toast.success("修改成功");
        props.onSubmit?.(data);
        resetTopicData();
      },
    });

    const handleSubmit = () => {
      if (!validateForm())
        return;

      submitting.value = true;
      if (props.id) {
        updateMutation.mutate(
          { id: props.id, data: topic },
          { onSettled: () => (submitting.value = false) },
        );
      } else {
        createMutation.mutate(topic, {
          onSettled: () => (submitting.value = false),
        });
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
            handleClose();
        }}
        closeOnEsc
        transformOrigin="center"
      >
        <div
          class="rounded-xl bg-white max-w-lg w-full shadow-xl dark:bg-neutral-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="topic-modal-title"
          onKeydown={handleKeydown}
        >
          <div class="px-5 py-4 border-b border-neutral-200 flex items-center justify-between dark:border-neutral-800">
            <h2
              id="topic-modal-title"
              class="text-lg text-neutral-900 font-semibold dark:text-neutral-100"
            >
              {props.id ? "编辑专栏" : "新建专栏"}
            </h2>
            <button
              type="button"
              class="text-neutral-400 p-1 rounded-lg transition-colors hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={handleClose}
              aria-label="关闭"
            >
              <X class="size-5" />
            </button>
          </div>

          <div class="px-5 py-4">
            {loading.value
              ? (
                  <div class="py-12 flex items-center justify-center">
                    <NSpin size="medium" />
                  </div>
                )
              : (
                  <>
                    <FormField label="名称" required error={errors.name}>
                      <NInput
                        value={topic.name}
                        onUpdateValue={v => (topic.name = v)}
                        placeholder="输入专栏名称"
                        maxlength={50}
                        showCount
                      />
                    </FormField>

                    <FormField label="ID (Slug)" required error={errors.slug}>
                      <NInput
                        value={topic.slug}
                        onUpdateValue={v => (topic.slug = v)}
                        placeholder="输入唯一标识，如 my-topic"
                      />
                      <p class="text-xs text-neutral-400 mt-1">
                        用于 URL，只能包含字母、数字、下划线和连字符
                      </p>
                    </FormField>

                    <FormField label="简介" required error={errors.introduce}>
                      <NInput
                        value={topic.introduce}
                        onUpdateValue={v => (topic.introduce = v)}
                        placeholder="简短介绍这个专栏"
                        maxlength={100}
                        showCount
                      />
                    </FormField>

                    <FormField label="图标">
                      <div class="flex gap-3 items-center">
                        {topic.icon && (
                          <img
                            src={topic.icon}
                            alt="专栏图标"
                            class="rounded-lg shrink-0 size-10 object-cover"
                          />
                        )}
                        <NInput
                          value={topic.icon ?? ""}
                          onUpdateValue={v => (topic.icon = v)}
                          placeholder="输入图标 URL 或上传"
                          class="flex-1 min-w-0"
                        />
                        <UploadWrapper
                          class="!w-auto"
                          type="icon"
                          onFinish={(e) => {
                            const res = JSON.parse(
                              (e.event?.target as XMLHttpRequest).responseText,
                            );
                            topic.icon = res.url;
                            return e.file;
                          }}
                        >
                          <NButton
                            quaternary
                            type="primary"
                            circle
                            aria-label="上传图标"
                          >
                            <UploadIcon class="size-4" />
                          </NButton>
                        </UploadWrapper>
                      </div>
                    </FormField>

                    <FormField label="详细描述" error={errors.description}>
                      <NInput
                        type="textarea"
                        value={topic.description}
                        onUpdateValue={v => (topic.description = v)}
                        placeholder="可选的详细描述"
                        autosize={{ minRows: 2, maxRows: 5 }}
                        maxlength={500}
                        showCount
                      />
                    </FormField>
                  </>
                )}
          </div>

          <div class="px-5 py-4 border-t border-neutral-200 flex gap-2 items-center justify-end dark:border-neutral-800">
            <NButton onClick={handleClose}>取消</NButton>
            <NButton
              type="primary"
              loading={submitting.value}
              disabled={loading.value}
              onClick={handleSubmit}
            >
              {props.id ? "保存修改" : "创建专栏"}
            </NButton>
          </div>
        </div>
      </NModal>
    );
  },
});
