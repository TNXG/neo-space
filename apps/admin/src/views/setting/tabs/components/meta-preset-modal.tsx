import type { PropType } from "vue";
import type {
  CreateMetaPresetDto,
  MetaFieldType,
  MetaPresetField,
  MetaPresetScope,
} from "~/models/meta-preset";
import { useMutation } from "@tanstack/vue-query";
import {
  Plus as PlusIcon,
  Trash2 as Trash2Icon,
  X as XIcon,
} from "lucide-vue-next";
import {
  NButton,
  NCheckbox,
  NInput,
  NModal,
  NSelect,
  NSpin,
  NSwitch,
} from "naive-ui";
import { defineComponent, nextTick, reactive, ref, watch } from "vue";

import { toast } from "vue-sonner";

import { metaPresetsApi } from "~/api/meta-presets";

const fieldTypeOptions: { label: string; value: MetaFieldType }[] = [
  { label: "文本", value: "text" },
  { label: "多行文本", value: "textarea" },
  { label: "数字", value: "number" },
  { label: "URL", value: "url" },
  { label: "单选", value: "select" },
  { label: "多选", value: "multi-select" },
  { label: "复选框", value: "checkbox" },
  { label: "标签", value: "tags" },
  { label: "开关", value: "boolean" },
  { label: "对象", value: "object" },
];

const scopeOptions: { label: string; value: MetaPresetScope }[] = [
  { label: "博文", value: "post" },
  { label: "笔记", value: "note" },
  { label: "通用", value: "both" },
];

const typesWithOptions: MetaFieldType[] = ["select", "multi-select", "checkbox"];

const FormField = defineComponent({
  props: {
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
    error: { type: String, required: false },
    hint: { type: String, required: false },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-4">
        <label class="text-sm text-neutral-700 font-medium mb-1.5 block dark:text-neutral-300">
          {props.label}
          {props.required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
        {slots.default?.()}
        {props.hint && !props.error && (
          <p class="text-xs text-neutral-400 mt-1">{props.hint}</p>
        )}
        {props.error && (
          <p class="text-xs text-red-500 mt-1" role="alert">
            {props.error}
          </p>
        )}
      </div>
    );
  },
});

export const MetaPresetModal = defineComponent({
  name: "MetaPresetModal",
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
      type: Function as PropType<(preset: MetaPresetField) => void>,
      required: false,
    },
  },
  setup(props) {
    const preset = reactive<Partial<CreateMetaPresetDto>>({
      type: "text",
      scope: "both",
      enabled: true,
    });
    const loading = ref(false);
    const submitting = ref(false);
    const errors = reactive<Record<string, string>>({});

    const resetPresetData = () => {
      Object.keys(preset).forEach((key) => {
        delete preset[key as keyof typeof preset];
      });
      preset.type = "text";
      preset.scope = "both";
      preset.enabled = true;
      Object.keys(errors).forEach((key) => {
        delete errors[key];
      });
    };

    const validateForm = (): boolean => {
      Object.keys(errors).forEach(key => delete errors[key]);

      if (!preset.key?.trim()) {
        errors.key = "请输入字段 Key";
      } else if (!/^[\w-]+$/.test(preset.key)) {
        errors.key = "Key 只能包含字母、数字、下划线和连字符";
      }

      if (!preset.label?.trim()) {
        errors.label = "请输入显示名称";
      }

      if (!preset.type) {
        errors.type = "请选择字段类型";
      }

      if (typesWithOptions.includes(preset.type as MetaFieldType)) {
        if (!preset.options || preset.options.length === 0) {
          errors.options = "请至少添加一个选项";
        }
      }

      if (preset.type === "object") {
        if (!preset.children || preset.children.length === 0) {
          errors.children = "请至少添加一个子字段";
        }
      }

      return Object.keys(errors).length === 0;
    };

    watch(
      () => props.id,
      (id) => {
        if (!id) {
          resetPresetData();
        } else {
          loading.value = true;
          metaPresetsApi
            .getById(id)
            .then((data) => {
              Object.assign(preset, data);
            })
            .finally(() => {
              loading.value = false;
            });
        }
      },
    );

    const handleClose = () => {
      props.onClose();
      nextTick(() => resetPresetData());
    };

    const createMutation = useMutation({
      mutationFn: (data: CreateMetaPresetDto) => metaPresetsApi.create(data),
      onSuccess: (data) => {
        toast.success("创建成功");
        props.onSubmit?.(data);
        resetPresetData();
      },
    });

    const updateMutation = useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: Partial<CreateMetaPresetDto>;
      }) => metaPresetsApi.update(id, data),
      onSuccess: (data) => {
        toast.success("修改成功");
        props.onSubmit?.(data);
        resetPresetData();
      },
    });

    const handleSubmit = () => {
      if (!validateForm())
        return;

      submitting.value = true;
      if (props.id) {
        updateMutation.mutate(
          { id: props.id, data: preset },
          { onSettled: () => (submitting.value = false) },
        );
      } else {
        createMutation.mutate(preset as CreateMetaPresetDto, {
          onSettled: () => (submitting.value = false),
        });
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        handleSubmit();
      }
    };

    const addOption = () => {
      if (!preset.options) {
        preset.options = [];
      }
      preset.options.push({ value: "", label: "" });
    };

    const removeOption = (index: number) => {
      preset.options?.splice(index, 1);
    };

    const addChild = () => {
      if (!preset.children) {
        preset.children = [];
      }
      preset.children.push({
        key: "",
        label: "",
        type: "text",
      });
    };

    const removeChild = (index: number) => {
      preset.children?.splice(index, 1);
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
          class="rounded-xl bg-white max-h-[90vh] max-w-2xl w-full shadow-xl overflow-hidden dark:bg-neutral-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="meta-preset-modal-title"
          onKeydown={handleKeydown}
        >
          <div class="px-5 py-4 border-b border-neutral-200 flex items-center justify-between dark:border-neutral-800">
            <h2
              id="meta-preset-modal-title"
              class="text-lg text-neutral-900 font-semibold dark:text-neutral-100"
            >
              {props.id ? "编辑预设字段" : "新建预设字段"}
            </h2>
            <button
              type="button"
              class="text-neutral-400 p-1 rounded-lg transition-colors hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={handleClose}
              aria-label="关闭"
            >
              <XIcon class="size-5" />
            </button>
          </div>

          <div class="px-5 py-4 max-h-[calc(90vh-140px)] overflow-y-auto">
            {loading.value
              ? (
                  <div class="py-12 flex items-center justify-center">
                    <NSpin size="medium" />
                  </div>
                )
              : (
                  <>
                    <div class="gap-4 grid grid-cols-2">
                      <FormField label="字段 Key" required error={errors.key}>
                        <NInput
                          value={preset.key}
                          onUpdateValue={v => (preset.key = v)}
                          placeholder="如: music, movie"
                        />
                      </FormField>

                      <FormField label="显示名称" required error={errors.label}>
                        <NInput
                          value={preset.label}
                          onUpdateValue={v => (preset.label = v)}
                          placeholder="如: 音乐, 电影"
                        />
                      </FormField>
                    </div>

                    <div class="gap-4 grid grid-cols-2">
                      <FormField label="字段类型" required error={errors.type}>
                        <NSelect
                          value={preset.type}
                          onUpdateValue={v => (preset.type = v)}
                          options={fieldTypeOptions}
                        />
                      </FormField>

                      <FormField label="作用域">
                        <NSelect
                          value={preset.scope}
                          onUpdateValue={v => (preset.scope = v)}
                          options={scopeOptions}
                        />
                      </FormField>
                    </div>

                    <FormField label="描述" hint="可选的字段描述">
                      <NInput
                        value={preset.description}
                        onUpdateValue={v => (preset.description = v)}
                        placeholder="字段用途说明"
                      />
                    </FormField>

                    <FormField label="占位文本" hint="输入框占位提示文本">
                      <NInput
                        value={preset.placeholder}
                        onUpdateValue={v => (preset.placeholder = v)}
                        placeholder="请输入..."
                      />
                    </FormField>

                    {typesWithOptions.includes(preset.type as MetaFieldType) && (
                      <FormField label="选项配置" required error={errors.options}>
                        <div class="space-y-2">
                          {preset.options?.map((option, index) => (
                            <div key={index} class="flex gap-2 items-center">
                              <NInput
                                value={option.value}
                                onUpdateValue={v => (option.value = v)}
                                placeholder="值"
                                class="flex-1"
                              />
                              <NInput
                                value={option.label}
                                onUpdateValue={v => (option.label = v)}
                                placeholder="显示文本"
                                class="flex-1"
                              />
                              <NButton
                                quaternary
                                type="error"
                                onClick={() => removeOption(index)}
                              >
                                <Trash2Icon class="size-4" />
                              </NButton>
                            </div>
                          ))}
                          <NButton quaternary type="primary" onClick={addOption}>
                            <PlusIcon class="mr-1 size-4" />
                            添加选项
                          </NButton>
                        </div>

                        {(preset.type === "select"
                          || preset.type === "multi-select") && (
                          <div class="mt-2 flex gap-2 items-center">
                            <NCheckbox
                              checked={preset.allowCustomOption}
                              onUpdateChecked={v =>
                                (preset.allowCustomOption = v)}
                            >
                              允许自定义选项
                            </NCheckbox>
                          </div>
                        )}
                      </FormField>
                    )}

                    {preset.type === "object" && (
                      <FormField
                        label="子字段配置"
                        required
                        error={errors.children}
                      >
                        <div class="space-y-3">
                          {preset.children?.map((child, index) => (
                            <div
                              key={index}
                              class="p-3 border border-neutral-200 rounded-lg dark:border-neutral-700"
                            >
                              <div class="mb-2 flex items-center justify-between">
                                <span class="text-sm text-neutral-600 font-medium dark:text-neutral-400">
                                  子字段
                                  {" "}
                                  {index + 1}
                                </span>
                                <NButton
                                  quaternary
                                  type="error"
                                  size="tiny"
                                  onClick={() => removeChild(index)}
                                >
                                  <Trash2Icon class="size-3.5" />
                                </NButton>
                              </div>
                              <div class="gap-2 grid grid-cols-3">
                                <NInput
                                  value={child.key}
                                  onUpdateValue={v => (child.key = v)}
                                  placeholder="Key"
                                  size="small"
                                />
                                <NInput
                                  value={child.label}
                                  onUpdateValue={v => (child.label = v)}
                                  placeholder="显示名称"
                                  size="small"
                                />
                                <NSelect
                                  value={child.type}
                                  onUpdateValue={v => (child.type = v)}
                                  options={fieldTypeOptions.filter(
                                    o => o.value !== "object",
                                  )}
                                  size="small"
                                />
                              </div>
                            </div>
                          ))}
                          <NButton quaternary type="primary" onClick={addChild}>
                            <PlusIcon class="mr-1 size-4" />
                            添加子字段
                          </NButton>
                        </div>
                      </FormField>
                    )}

                    <div class="px-4 py-3 border border-neutral-200 rounded-lg bg-neutral-50 flex items-center justify-between dark:border-neutral-700 dark:bg-neutral-800">
                      <div>
                        <span class="text-sm text-neutral-700 font-medium dark:text-neutral-200">
                          启用此预设
                        </span>
                        <p class="text-xs text-neutral-500 dark:text-neutral-400">
                          禁用后不会在写作页面显示
                        </p>
                      </div>
                      <NSwitch
                        value={preset.enabled}
                        onUpdateValue={v => (preset.enabled = v)}
                      />
                    </div>
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
              {props.id ? "保存修改" : "创建预设"}
            </NButton>
          </div>
        </div>
      </NModal>
    );
  },
});
