import type { ManagedOptionKey, OptionDocument } from "@/types/api";

/** 只描述真实后端消费者使用的配置，不向后台引入新的数据库字段。 */
export interface OptionField {
  path: string;
  label: string;
  type: "text" | "url" | "email" | "textarea" | "password" | "number" | "boolean" | "lines" | "select" | "object-list";
  description?: string;
  environment?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  choices?: readonly { value: string; label: string }[];
  providerChoices?: boolean;
  fields?: readonly OptionField[];
  initial?: OptionDocument;
}

export interface OptionSection {
  title: string;
  icon: string;
  description?: string;
  fields: readonly OptionField[];
}

export interface OptionGroup {
  key: ManagedOptionKey;
  slug: string;
  title: string;
  icon: string;
  description: string;
  sections: readonly OptionSection[];
}
