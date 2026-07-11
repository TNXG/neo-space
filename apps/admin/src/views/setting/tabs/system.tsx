import type { PropType } from "vue";
import type { OptionValue } from "~/api/options";
import type { AIConfig } from "./sections/ai-config";
import { cloneDeep, isEqual } from "es-toolkit/compat";
import { RotateCcw as ResetIcon, Save as SaveIcon } from "lucide-vue-next";
import { NButton, NEmpty } from "naive-ui";
import { computed, defineComponent, ref, shallowRef, watch } from "vue";
import { toast } from "vue-sonner";

import { optionsApi } from "~/api/options";
import { SectionFields } from "~/components/config-form";
import { SettingsSection } from "~/layouts/settings-layout";

import { OPTION_FORM_SCHEMAS } from "../option-form-schema";
import { getOptionMetadata, isOptionValue } from "../option-metadata";
import { AIConfigSection } from "./sections/ai-config";
import { OAuthConfigSection } from "./sections/oauth-config";

export const autosizeableProps = {
  autosize: true,
  clearable: true,
  style: "min-width: 300px; max-width: 100%",
} as const;

/** 根据配置定义渲染受控表单，保存时完整替换对应 options value。 */
export const TabSystem = defineComponent({
  props: {
    optionKey: { type: String, required: true },
    value: { type: null as unknown as PropType<OptionValue>, required: true },
  },
  emits: ["saved"],
  setup(props, { emit }) {
    const formData = ref<Record<string, unknown>>({});
    const originalValue = shallowRef<unknown>(null);
    const isSaving = ref(false);
    const metadata = computed(() => getOptionMetadata(props.optionKey));
    const sections = computed(() => OPTION_FORM_SCHEMAS[props.optionKey] ?? []);
    const isDirty = computed(() =>
      !isEqual(originalValue.value, formData.value[props.optionKey]),
    );

    const reset = () => {
      originalValue.value = cloneDeep(props.value);
      formData.value = { [props.optionKey]: cloneDeep(props.value) };
    };

    watch(
      () => [props.optionKey, props.value] as const,
      reset,
      { immediate: true, deep: true },
    );

    const save = async () => {
      const value = formData.value[props.optionKey];
      if (!isOptionValue(value) || !isDirty.value || isSaving.value) {
        return;
      }
      try {
        isSaving.value = true;
        const savedValue = await optionsApi.replace(props.optionKey, value);
        originalValue.value = cloneDeep(savedValue);
        formData.value = { [props.optionKey]: cloneDeep(savedValue) };
        emit("saved", savedValue);
        toast.success("配置已保存，重启后应用运行时配置");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "保存失败，请重试");
      } finally {
        isSaving.value = false;
      }
    };

    return () => (
      <div class="space-y-6">
        {props.optionKey === "ai"
          ? (
              <AIConfigSection
                value={formData.value.ai as AIConfig}
                onUpdate={(value) => { formData.value.ai = value; }}
              />
            )
          : props.optionKey === "oauth"
            ? (
                <OAuthConfigSection
                  value={formData.value.oauth as OptionValue}
                  onUpdate={(value) => { formData.value.oauth = value; }}
                />
              )
          : sections.value.length > 0
            ? sections.value.map(section => (
                <SettingsSection key={section.key} title={section.title} description={section.description}>
                  <SectionFields
                    fields={section.fields}
                    formData={formData}
                    dataKeyPrefix={section.key}
                  />
                </SettingsSection>
              ))
            : <NEmpty description="该配置没有可编辑字段" />}

        {(props.optionKey === "ai" || props.optionKey === "oauth" || sections.value.length > 0) && (
          <div class="pb-6 flex gap-2 justify-end">
            <NButton disabled={!isDirty.value || isSaving.value} onClick={reset} renderIcon={() => <ResetIcon size={15} />}>
              还原
            </NButton>
            <NButton type="primary" loading={isSaving.value} disabled={!isDirty.value} onClick={save} renderIcon={() => <SaveIcon size={15} />}>
              保存配置
            </NButton>
          </div>
        )}
        <p class="text-xs text-neutral-400 pb-2 m-0">
          数据库键：{props.optionKey} · {metadata.value.description}
        </p>
      </div>
    );
  },
});
