import type { InjectionKey, PropType, Ref } from "vue";
import type { FormField } from "./types";
import { get, set } from "es-toolkit/compat";
import { marked } from "marked";
import {
  NButton,
  NDynamicTags,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
} from "naive-ui";
import { defineComponent, inject, provide } from "vue";

import { SettingsItem } from "~/layouts/settings-layout";
import { uuid } from "~/utils";

export type ActionHandler = (actionId: string) => void;
export const ActionHandlerKey: InjectionKey<ActionHandler> = Symbol(
  "config-form-action-handler",
);

/**
 * Compare values for showWhen conditions.
 * Handles boolean/string coercion for values like { aiReview: 'true' }
 */
function matchShowWhenValue(actualValue: unknown, expected: unknown): boolean {
  if (actualValue === expected)
    return true;
  if (typeof actualValue === "boolean" && typeof expected === "string") {
    return String(actualValue) === expected;
  }
  if (typeof actualValue === "string" && typeof expected === "boolean") {
    return actualValue === String(expected);
  }
  return false;
}

/**
 * Check if a field should be shown based on showWhen conditions.
 * When the condition is not met, the field and all its nested children are hidden.
 */
function shouldShowField(
  field: FormField,
  formData: Ref<Record<string, unknown>>,
  sectionPrefix: string,
): boolean {
  const { showWhen } = field.ui;
  if (!showWhen)
    return true;

  for (const [key, expected] of Object.entries(showWhen)) {
    const actualValue = get(formData.value, `${sectionPrefix}.${key}`);
    if (Array.isArray(expected)) {
      if (!expected.some(exp => matchShowWhenValue(actualValue, exp))) {
        return false;
      }
    } else {
      if (!matchShowWhenValue(actualValue, expected))
        return false;
    }
  }
  return true;
}

export const SectionFields = defineComponent({
  props: {
    fields: {
      type: Array as PropType<FormField[]>,
      required: true,
    },
    formData: {
      type: Object as PropType<Ref<Record<string, unknown>>>,
      required: true,
    },
    dataKeyPrefix: {
      type: String,
      required: true,
    },
    onAction: {
      type: Function as PropType<ActionHandler>,
    },
  },
  setup(props) {
    const parentHandler = inject(ActionHandlerKey, undefined);
    const handler = props.onAction || parentHandler;

    if (handler) {
      provide(ActionHandlerKey, handler);
    }

    return () => {
      const { fields, formData, dataKeyPrefix } = props;

      return (
        <>
          {fields
            .filter(field => !field.ui.hidden)
            .filter(field => shouldShowField(field, formData, dataKeyPrefix))
            .map((field) => {
              const fieldPath = `${dataKeyPrefix}.${field.key}`;

              // Handle nested fields (object type)
              if (field.fields && field.fields.length > 0) {
                if (field.subsection) {
                  return (
                    <Subsection
                      key={fieldPath}
                      title={field.subsection.title}
                      description={field.subsection.description}
                    >
                      <SectionFields
                        fields={field.fields}
                        formData={formData}
                        dataKeyPrefix={fieldPath}
                      />
                    </Subsection>
                  );
                }
                return (
                  <SectionFields
                    fields={field.fields}
                    formData={formData}
                    dataKeyPrefix={fieldPath}
                  />
                );
              }

              return (
                <FormFieldItem
                  key={fieldPath}
                  field={field}
                  value={get(formData.value, fieldPath, undefined)}
                  onUpdateValue={(val) => {
                    const parentPath = dataKeyPrefix;
                    const parentValue = get(formData.value, parentPath);
                    if (parentValue) {
                      set(formData.value, fieldPath, val);
                    } else {
                      set(formData.value, parentPath, {
                        ...(typeof parentValue === "object" && parentValue !== null && !Array.isArray(parentValue)
                          ? parentValue
                          : {}),
                        [field.key]: val,
                      });
                    }
                  }}
                />
              );
            })}
        </>
      );
    };
  },
});

export const FormFieldItem = defineComponent({
  props: {
    field: {
      type: Object as PropType<FormField>,
      required: true,
    },
    value: {
      type: null as unknown as PropType<unknown>,
      required: false,
    },
    onUpdateValue: {
      type: Function as PropType<(value: unknown) => void>,
      required: true,
    },
  },
  setup(props) {
    const actionHandler = inject(ActionHandlerKey, undefined);
    const inputId = uuid();

    const renderComponent = () => {
      const { field } = props;
      const { ui } = field;

      switch (ui.component) {
        case "input":
          return (
            <NInput
              inputProps={{ id: inputId }}
              value={typeof props.value === "string" ? props.value : ""}
              onUpdateValue={(val: string | null) => {
                props.onUpdateValue(val ?? "");
              }}
              placeholder={ui.placeholder}
              clearable
            />
          );

        case "password":
          return (
            <NInput
              inputProps={{ id: inputId }}
              value={typeof props.value === "string" ? props.value : ""}
              onUpdateValue={(val: string | null) => {
                props.onUpdateValue(val ?? "");
              }}
              type="password"
              showPasswordOn="click"
              placeholder={ui.placeholder}
              clearable
            />
          );

        case "textarea":
          return (
            <NInput
              inputProps={{ id: inputId }}
              value={typeof props.value === "string" ? props.value : ""}
              onUpdateValue={(val: string | null) => {
                props.onUpdateValue(val ?? "");
              }}
              type="textarea"
              autosize={{ maxRows: 5, minRows: 3 }}
              placeholder={ui.placeholder}
              clearable
            />
          );

        case "number":
          return (
            <NInputNumber
              value={typeof props.value === "number" ? props.value : null}
              onUpdateValue={(val: number | null) => {
                props.onUpdateValue(val ?? 0);
              }}
              placeholder={ui.placeholder}
            />
          );

        case "switch":
          return (
            <NSwitch
              value={Boolean(props.value)}
              onUpdateValue={(val: boolean) => {
                props.onUpdateValue(val);
              }}
            />
          );

        case "select":
          return (
            <NSelect
              value={typeof props.value === "string" || typeof props.value === "number" ? props.value : null}
              onUpdateValue={(val: string | number | null) => {
                props.onUpdateValue(val);
              }}
              options={ui.options}
              filterable
              placeholder={ui.placeholder}
            />
          );

        case "tags":
          return (
            <NDynamicTags
              value={Array.isArray(props.value) ? props.value.filter((item): item is string => typeof item === "string") : []}
              onUpdateValue={(val: string[]) => {
                props.onUpdateValue(val);
              }}
            />
          );

        case "action":
          return (
            <NButton
              size="small"
              secondary
              onClick={() => {
                if (ui.actionId && actionHandler) {
                  actionHandler(ui.actionId);
                }
              }}
            >
              {ui.actionLabel || field.title}
            </NButton>
          );

        default:
          return null;
      }
    };

    return () => {
      const { field } = props;
      const { title, description } = field;

      return (
        <SettingsItem title={title}>
          {{
            default: () => renderComponent(),
            description: description
              ? () => <span innerHTML={marked.parse(description) as string} />
              : undefined,
          }}
        </SettingsItem>
      );
    };
  },
});

const Subsection = defineComponent({
  props: {
    title: { type: String, required: true },
    description: String,
  },
  setup(props, { slots }) {
    return () => (
      <div class="border-t border-neutral-100 first:border-t-0 dark:border-neutral-800">
        <div class="px-4 pb-2 pt-4">
          <div class="text-xs text-neutral-500 tracking-wide font-semibold uppercase dark:text-neutral-400">
            {props.title}
          </div>
          {props.description && (
            <p class="text-xs text-neutral-400 mt-1 dark:text-neutral-500">
              {props.description}
            </p>
          )}
        </div>
        {slots.default?.()}
      </div>
    );
  },
});
