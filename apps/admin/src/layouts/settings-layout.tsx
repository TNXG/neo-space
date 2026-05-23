import type { PropType, VNode } from "vue";
import { ArrowLeft as ArrowLeftIcon } from "lucide-vue-next";
import { NScrollbar } from "naive-ui";
import { defineComponent } from "vue";

import { useMasterDetailLayout } from "~/components/layout";

/**
 * 设置详情面板容器
 */
export const SettingsDetailPanel = defineComponent({
  name: "SettingsDetailPanel",
  props: {
    title: String,
    onBack: Function as PropType<() => void>,
  },
  setup(props, { slots }) {
    const { isMobile } = useMasterDetailLayout();

    return () => (
      <div class="flex flex-col h-full">
        {/* Header */}
        <div class="px-4 border-b border-neutral-200 flex flex-shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            {isMobile.value && props.onBack && (
              <button
                onClick={props.onBack}
                class="text-neutral-500 rounded-md flex size-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon class="size-5" />
              </button>
            )}
            <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              {props.title}
            </h2>
          </div>
          {slots.actions && (
            <div class="flex gap-2 items-center">{slots.actions()}</div>
          )}
        </div>

        {/* Content */}
        <NScrollbar class="flex-1 min-h-0">
          <div class="mx-auto p-6 max-w-3xl">{slots.default?.()}</div>
        </NScrollbar>
      </div>
    );
  },
});

/**
 * 设置 Section 分组标题
 */
export const SettingsSection = defineComponent({
  name: "SettingsSection",
  props: {
    title: String,
    description: String,
    icon: Object as PropType<any>,
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-6 last:mb-0">
        {/* Section Header */}
        <div class="mb-4 flex items-center justify-between">
          <div class="flex gap-3 items-center">
            {props.icon && (
              <div class="text-neutral-500 rounded-lg bg-neutral-100 flex size-8 items-center justify-center dark:text-neutral-400 dark:bg-neutral-800">
                <props.icon class="size-4" />
              </div>
            )}
            <div>
              <h3 class="text-sm text-neutral-900 font-semibold dark:text-neutral-100">
                {props.title || slots.title?.()}
              </h3>
              {(props.description || slots.description) && (
                <p class="text-xs text-neutral-500 mt-0.5 dark:text-neutral-400">
                  {props.description || slots.description?.()}
                </p>
              )}
            </div>
          </div>
          {slots.actions && <div class="shrink-0">{slots.actions()}</div>}
        </div>

        {/* Section Content */}
        <div class="border-y border-neutral-100 divide-neutral-100 divide-y dark:border-neutral-800 dark:divide-neutral-800">
          {slots.default?.()}
        </div>
      </div>
    );
  },
});

/**
 * 设置项行（分栏布局）
 */
export const SettingsRow = defineComponent({
  name: "SettingsRow",
  props: {
    title: String,
    description: [String, Object] as PropType<string | VNode>,
    layout: {
      type: String as PropType<"row" | "col">,
      default: "row",
    },
  },
  setup(props, { slots }) {
    return () => (
      <div
        class={[
          "flex gap-4 px-4 py-4",
          props.layout === "row"
            ? "flex-col md:flex-row md:items-start md:gap-8"
            : "flex-col",
        ]}
      >
        <div
          class={[
            "flex min-w-0 flex-col",
            props.layout === "row" ? "md:w-1/3 md:max-w-xs md:shrink-0" : "",
          ]}
        >
          <label class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
            {props.title || slots.title?.()}
          </label>
          {(props.description || slots.description) && (
            <div class="text-xs text-neutral-500 leading-relaxed mt-1 dark:text-neutral-400">
              {props.description || slots.description?.()}
            </div>
          )}
        </div>

        <div class="flex-1 min-w-0">{slots.default?.()}</div>
      </div>
    );
  },
});

// Legacy exports for compatibility
export const SettingsCard = SettingsSection;
export const SettingsItem = SettingsRow;
