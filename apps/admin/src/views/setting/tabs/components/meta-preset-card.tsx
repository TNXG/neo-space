import type { PropType } from "vue";
import type {
  MetaFieldType,
  MetaPresetField,
  MetaPresetScope,
} from "~/models/meta-preset";
import {
  GripVertical as GripVerticalIcon,
  Lock as LockIcon,
  Pencil as PencilIcon,
  Trash2 as Trash2Icon,
} from "lucide-vue-next";
import { NButton, NPopconfirm, NSwitch, NTag } from "naive-ui";
import { defineComponent } from "vue";

const fieldTypeLabels: Record<MetaFieldType, string> = {
  "text": "文本",
  "textarea": "多行文本",
  "number": "数字",
  "url": "URL",
  "select": "单选",
  "multi-select": "多选",
  "checkbox": "复选框",
  "tags": "标签",
  "boolean": "开关",
  "object": "对象",
};

const scopeLabels: Record<MetaPresetScope, string> = {
  post: "博文",
  note: "笔记",
  both: "通用",
};

const scopeColors: Record<MetaPresetScope, "info" | "success" | "warning"> = {
  post: "info",
  note: "success",
  both: "warning",
};

export const MetaPresetCard = defineComponent({
  name: "MetaPresetCard",
  props: {
    preset: {
      type: Object as PropType<MetaPresetField>,
      required: true,
    },
    onEdit: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    onToggleEnabled: {
      type: Function as PropType<(preset: MetaPresetField) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="group px-4 py-3 flex gap-3 transition-colors items-center hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
        {!props.preset.isBuiltin && (
          <div class="text-neutral-300 shrink-0 cursor-grab dark:text-neutral-600">
            <GripVerticalIcon class="size-4" />
          </div>
        )}

        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap gap-2 items-center">
            <span class="text-neutral-900 font-medium dark:text-neutral-100">
              {props.preset.label}
            </span>
            <code class="text-xs text-neutral-500 font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800">
              {props.preset.key}
            </code>
            {props.preset.isBuiltin && (
              <NTag size="tiny" type="default" round>
                {{
                  icon: () => <LockIcon class="size-3" />,
                  default: () => <span class="text-xs">内置</span>,
                }}
              </NTag>
            )}
          </div>
          <div class="text-sm text-neutral-500 mt-1 flex flex-wrap gap-2 items-center dark:text-neutral-400">
            <NTag size="tiny" type="info" bordered={false}>
              {fieldTypeLabels[props.preset.type]}
            </NTag>
            <NTag
              size="tiny"
              type={scopeColors[props.preset.scope]}
              bordered={false}
            >
              {scopeLabels[props.preset.scope]}
            </NTag>
            {props.preset.description && (
              <span class="truncate">{props.preset.description}</span>
            )}
          </div>
        </div>

        <div class="ml-auto flex shrink-0 gap-2 items-center">
          <NSwitch
            size="small"
            value={props.preset.enabled}
            onUpdateValue={() => props.onToggleEnabled(props.preset)}
          />

          {!props.preset.isBuiltin && (
            <NButton
              size="tiny"
              quaternary
              type="primary"
              onClick={() => props.onEdit(props.preset.id)}
            >
              <PencilIcon class="size-3.5" />
            </NButton>
          )}

          {!props.preset.isBuiltin && (
            <NPopconfirm
              onPositiveClick={() => props.onDelete(props.preset.id)}
              positiveText="删除"
              negativeText="取消"
            >
              {{
                trigger: () => (
                  <NButton size="tiny" quaternary type="error">
                    <Trash2Icon class="size-3.5" />
                  </NButton>
                ),
                default: () => (
                  <span>
                    确定要删除预设字段「
                    {props.preset.label}
                    」吗？
                  </span>
                ),
              }}
            </NPopconfirm>
          )}
        </div>
      </div>
    );
  },
});
