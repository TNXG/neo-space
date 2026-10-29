import type { ManagedOptionKey, OptionDocument, OptionValue } from "@/types/api";

/** 控件按用户操作划分，而不是按后端 JSON 类型机械映射。 */
export type ControlKind = "text" | "url" | "email" | "password" | "textarea" | "number" | "switch" | "choice" | "tags" | "list" | "collection";

/** 选择项只承载真实后端允许的值。 */
export interface SettingOption {
  value: string;
  label: string;
}

/** 条件禁用不修改值，只停止交互并说明原因。 */
export interface SettingRequirement {
  path: string;
  equals: OptionValue;
  hint: string;
}

/** 单个配置字段的声明。 */
export interface SettingField {
  path: string;
  label: string;
  control: ControlKind;
  hint?: string;
  help?: string;
  env?: string;
  required?: boolean;
  placeholder?: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: readonly SettingOption[];
  optionsFromProviders?: boolean;
  itemLabel?: string;
  fields?: readonly SettingField[];
  defaults?: OptionDocument;
  uniqueBy?: "id" | "type";
  disabledWhen?: readonly SettingRequirement[];
}

/** 一组相关字段；说明文字通过帮助入口按需展开。 */
export interface SettingSection {
  title: string;
  icon: string;
  help?: string;
  fields: readonly SettingField[];
}

/** 设置分组与路由、导航共用同一来源。 */
export interface SettingGroup {
  key: ManagedOptionKey;
  slug: string;
  title: string;
  icon: string;
  help: string;
  sections: readonly SettingSection[];
}
