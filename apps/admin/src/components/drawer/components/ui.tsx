import type { Component, PropType } from "vue";
/**
 * Drawer 统一 UI 组件系统
 * 提供一致的视觉语言和交互模式
 */
import { NSwitch } from "naive-ui";
import { defineComponent, h } from "vue";

/**
 * 分组标题
 */
export const SectionTitle = defineComponent({
  props: {
    icon: {
      type: Object as PropType<Component>,
      required: false,
    },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-4 mt-8 flex gap-2 items-center first:mt-0">
        {props.icon
          && h(props.icon, {
            "class": "size-4 text-neutral-400",
            "aria-hidden": "true",
          })}
        <span class="text-xs text-neutral-500 tracking-wide font-medium uppercase">
          {slots.default?.()}
        </span>
      </div>
    );
  },
});

/**
 * 表单字段 - Label 在上方
 */
export const FormField = defineComponent({
  props: {
    label: {
      type: String,
      required: true,
    },
    required: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      required: false,
    },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-3">
        <label class="text-xs text-neutral-500 mb-1 block dark:text-neutral-400">
          {props.label}
          {props.required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
        {props.description && (
          <p class="text-xs text-neutral-400 mb-1">{props.description}</p>
        )}
        <div class="w-full">{slots.default?.()}</div>
      </div>
    );
  },
});

/**
 * Switch 行 - 用于开关类设置项，label 和 switch 两端对齐
 */
export const SwitchRow = defineComponent({
  props: {
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    modelValue: {
      type: Boolean,
      required: true,
    },
    onUpdate: {
      type: Function as PropType<(value: boolean) => void>,
      required: true,
    },
    checkedText: {
      type: String,
      required: false,
    },
    uncheckedText: {
      type: String,
      required: false,
    },
  },
  setup(props) {
    return () => (
      <div
        class="px-2 py-2 flex cursor-pointer items-center justify-between -mx-2"
        onClick={() => props.onUpdate(!props.modelValue)}
        role="switch"
        aria-checked={props.modelValue}
        aria-label={props.label}
        tabindex={0}
        onKeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            props.onUpdate(!props.modelValue);
          }
        }}
      >
        <div class="flex flex-col">
          <span class="text-xs text-neutral-600 dark:text-neutral-300">
            {props.label}
          </span>
          {props.description && (
            <span class="text-xs text-neutral-400">{props.description}</span>
          )}
        </div>
        <div onClick={(e: MouseEvent) => e.stopPropagation()}>
          <NSwitch
            value={props.modelValue}
            onUpdateValue={props.onUpdate}
            size="small"
          >
            {props.checkedText || props.uncheckedText
              ? {
                  checked: () => props.checkedText,
                  unchecked: () => props.uncheckedText,
                }
              : undefined}
          </NSwitch>
        </div>
      </div>
    );
  },
});

/**
 * 内联字段行 - Label 和控件在同一行
 */
export const InlineField = defineComponent({
  props: {
    label: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-4 flex gap-4 items-start justify-between">
        <div class="pt-1.5 flex flex-col">
          <span class="text-sm text-neutral-600 dark:text-neutral-300">
            {props.label}
          </span>
          {props.description && (
            <span class="text-xs text-neutral-400">{props.description}</span>
          )}
        </div>
        <div class="flex-1">{slots.default?.()}</div>
      </div>
    );
  },
});

/**
 * 字段组 - 用于将多个相关字段组合在一起
 */
export const FieldGroup = defineComponent({
  props: {
    label: {
      type: String,
      required: false,
    },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-4 p-3 border border-neutral-200 rounded-lg dark:border-neutral-700">
        {props.label && (
          <div class="text-xs text-neutral-500 font-medium mb-2">
            {props.label}
          </div>
        )}
        {slots.default?.()}
      </div>
    );
  },
});

/**
 * 操作按钮组
 */
export const ActionRow = defineComponent({
  props: {
    label: {
      type: String,
      required: false,
    },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-4 flex items-center justify-between">
        {props.label && (
          <span class="text-sm text-neutral-600 dark:text-neutral-300">
            {props.label}
          </span>
        )}
        <div class={props.label ? "" : "w-full"}>{slots.default?.()}</div>
      </div>
    );
  },
});

/**
 * 分隔线
 */
export const Divider = defineComponent({
  setup() {
    return () => <div class="my-4 bg-neutral-100 h-px dark:bg-neutral-800" />;
  },
});

/**
 * 信息展示
 */
export const InfoDisplay = defineComponent({
  props: {
    label: {
      type: String,
      required: true,
    },
  },
  setup(props, { slots }) {
    return () => (
      <div class="text-sm mb-2 flex items-center justify-between">
        <span class="text-neutral-500">{props.label}</span>
        <span class="text-neutral-700 dark:text-neutral-200">
          {slots.default?.()}
        </span>
      </div>
    );
  },
});
