"use client";

import type { OptionDocument, OptionValue } from "@/types/api";
import { SettingsChoice, SettingsNumber, SettingsSwitch, SettingsText } from "./settings-controls";
import { SettingsList, SettingsTags } from "./settings-list-controls";
import { SettingsCollection } from "./settings-collection";
import { SettingsRow } from "./settings-row";
import type { SettingField } from "./settings-schema";
import { isDocument, readValue, sameValue, writeValue, type SettingsIssue } from "./settings-model";
import { providerChoices } from "./settings-validation";

interface FieldProps {
  field: SettingField;
  document: OptionDocument;
  root: OptionDocument;
  relative: string;
  path: string;
  id: string;
  disabled: boolean;
  issues: readonly SettingsIssue[];
  onChange: (path: string, value: OptionValue | undefined) => void;
}

/** 根据字段声明选择语义控件；数组与集合使用专用编辑器。 */
export function SettingsField({ field, document, root, relative, path, id, disabled, issues, onChange }: FieldProps) {
  const value = readValue(document, relative);
  const requirement = field.disabledWhen?.find(item => sameValue(readValue(root, item.path), item.equals));
  const inactive = disabled || requirement !== undefined;
  const error = issues.find(issue => issue.path === path)?.message;
  const describedBy = `${id}-hint`;

  const row = (_control: React.ReactNode, variant: "stacked" | "switch" = "stacked", controlId?: string) => (
    <SettingsRow id={id} controlId={controlId} path={path} label={field.label} hint={field.hint} help={field.help} env={field.env} error={error} disabledHint={requirement?.hint} variant={variant}>
      {_control}
    </SettingsRow>
  );

  const text = typeof value === "string" ? value : "";
  const strings = Array.isArray(value) && value.every(item => typeof item === "string") ? value : [];
  const incompatibleArray = (field.control === "tags" || field.control === "list") && value !== undefined && (!Array.isArray(value) || !value.every(item => typeof item === "string"));

  if (field.control === "switch") {
    return row(
      <SettingsSwitch id={id} value={typeof value === "boolean" ? value : undefined} disabled={inactive} describedBy={describedBy} onChange={next => onChange(path, next)} />,
      "switch",
      id,
    );
  }

  if (field.control === "number") {
    return row(
      <SettingsNumber id={id} value={typeof value === "number" ? value : undefined} min={field.min} max={field.max} step={field.step} unit={field.unit} placeholder={field.placeholder} disabled={inactive} invalid={Boolean(error)} describedBy={describedBy} onChange={next => onChange(path, next)} />,
      "stacked",
      id,
    );
  }

  if (field.control === "choice") {
    const options = field.optionsFromProviders ? providerChoices(root) : field.options ?? [];
    return row(
      <SettingsChoice id={id} value={text} options={options} disabled={inactive} invalid={Boolean(error)} describedBy={describedBy} onChange={next => onChange(path, next)} />,
      "stacked",
      id,
    );
  }

  if (field.control === "tags" || field.control === "list") {
    const Editor = field.control === "tags" ? SettingsTags : SettingsList;
    return row(
      <Editor id={id} value={strings} disabled={inactive || incompatibleArray} invalid={Boolean(error)} describedBy={describedBy} placeholder={field.placeholder} itemLabel={field.itemLabel} onChange={next => onChange(path, next)} />,
    );
  }

  if (field.control === "collection") {
    const entries = Array.isArray(value) && value.every(isDocument) ? value : [];
    const incompatible = value !== undefined && !(Array.isArray(value) && value.every(isDocument));
    return row(
      <SettingsCollection
        field={field}
        entries={entries}
        pathPrefix={path}
        disabled={inactive}
        incompatible={incompatible}
        issuePaths={issues.map(issue => issue.path)}
        onChange={next => onChange(path, next)}
        renderEntry={(entry, entryPath) => (field.fields ?? []).map(child => (
          <SettingsField
            key={child.path}
            field={child}
            document={entry}
            root={root}
            relative={child.path}
            path={`${entryPath}.${child.path}`}
            id={`${id}-${entryPath.slice(path.length + 1)}-${child.path}`.replaceAll(".", "-")}
            disabled={inactive}
            issues={issues}
            onChange={(childPath, next) => {
              const index = Number(entryPath.slice(path.length + 1));
              const relativePath = childPath.slice(entryPath.length + 1);
              // 整体写回数组，避免把 providers.0.xxx 当作对象路径破坏服务商列表。
              onChange(path, entries.map((item, itemIndex) => itemIndex === index ? writeValue(item, relativePath, next) : item));
            }}
          />
        ))}
      />,
    );
  }

  return row(
    <SettingsText id={id} type={field.control} value={text} placeholder={field.placeholder} multiline={field.control === "textarea"} disabled={inactive} invalid={Boolean(error)} describedBy={describedBy} onChange={next => onChange(path, next)} />,
    "stacked",
    id,
  );
}
