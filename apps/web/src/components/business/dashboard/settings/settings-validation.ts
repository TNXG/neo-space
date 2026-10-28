import type { OptionDocument, OptionValue } from "@/types/api";
import type { SettingField, SettingGroup } from "./settings-schema";
import { isDocument, readValue, type SettingsIssue } from "./settings-model";

/** 遍历分组声明，返回可直接定位到字段的问题列表。 */
export function validateSettings(group: SettingGroup, document: OptionDocument): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  for (const section of group.sections) validateFields(section.fields, document, document, issues);
  if (group.key === "ai") validateAiAssignments(document, issues);
  return issues;
}

/** 集合条目会拼接完整路径，让界面能展开并聚焦到具体输入。 */
function validateFields(fields: readonly SettingField[], document: OptionDocument, root: OptionDocument, issues: SettingsIssue[], prefix = "") {
  for (const field of fields) {
    const path = prefix ? `${prefix}.${field.path}` : field.path;
    const value = readValue(document, field.path);
    if (field.required && (value === undefined || value === null || value === "")) {
      issues.push({ path, message: `请填写${field.label}。` });
      continue;
    }
    if (field.control === "number" && typeof value === "number") {
      if (field.min !== undefined && value < field.min) issues.push({ path, message: `${field.label}不能小于 ${field.min}。` });
      if (field.max !== undefined && value > field.max) issues.push({ path, message: `${field.label}不能大于 ${field.max}。` });
    }
    if (field.control === "choice" && typeof value === "string" && value) {
      const choices = field.optionsFromProviders ? providerChoices(root) : field.options ?? [];
      if ((field.optionsFromProviders || choices.length > 0) && !choices.some(choice => choice.value === value)) {
        issues.push({ path, message: `${field.label}引用了已不存在的选项，请重新选择。` });
      }
    }
    if ((field.control === "tags" || field.control === "list") && value !== undefined) {
      if (!Array.isArray(value) || !value.every(item => typeof item === "string")) {
        issues.push({ path, message: `${field.label}的数据格式不兼容，未覆盖原值。` });
      } else if (field.control === "list" && value.some(item => !item.trim())) {
        issues.push({ path, message: `${field.label}中存在空白条目，请填写或删除。` });
      }
    }
    if (field.control === "collection") validateCollection(field, value, root, issues, path);
  }
}

/** 集合条目逐项校验，并把技术标识重复与引用失效区分开。 */
function validateCollection(field: SettingField, value: OptionValue | undefined, root: OptionDocument, issues: SettingsIssue[], collectionPath: string) {
  if (value === undefined) return;
  if (!Array.isArray(value) || !value.every(isDocument)) {
    issues.push({ path: collectionPath, message: `${field.label}的数据格式不兼容，未覆盖原值。` });
    return;
  }
  value.forEach((entry, index) => {
    for (const child of field.fields ?? []) validateFields([child], entry, root, issues, `${collectionPath}.${index}`);
  });
  if (!field.uniqueBy) return;
  const seen = new Set<string>();
  value.forEach((entry, index) => {
    const identity = entry[field.uniqueBy!];
    if (typeof identity !== "string" || !identity) return;
    if (seen.has(identity)) issues.push({ path: `${collectionPath}.${index}.${field.uniqueBy}`, message: `${field.label}的标识重复，请保证唯一。` });
    seen.add(identity);
  });
}

/** 服务商是唯一连接来源；启用的功能必须能解析到有效服务商和模型。 */
function validateAiAssignments(document: OptionDocument, issues: SettingsIssue[]) {
  const providers = Array.isArray(document.providers) ? document.providers.filter(isDocument) : [];
  const assignments = [
    { path: "summaryModel", label: "时间胶囊分析", enabled: document.enableSummary === true, fallback: true },
    { path: "translationModel", label: "内容翻译", enabled: document.enableTranslation === true, fallback: true },
    { path: "commentReviewModel", label: "评论 AI 审核", enabled: Boolean(readValue(document, "commentReviewModel.providerId") || readValue(document, "commentReviewModel.model")), fallback: false },
  ];
  for (const assignment of assignments) {
    if (!assignment.enabled) continue;
    const providerPath = `${assignment.path}.providerId`;
    const providerId = readValue(document, providerPath);
    const provider = providerId
      ? providers.find(item => item.id === providerId)
      : assignment.fallback ? providers.find(item => item.enabled === true) : undefined;
    if (!provider) {
      if (!issues.some(issue => issue.path === providerPath)) {
        issues.push({ path: providerPath, message: `请为${assignment.label}选择有效的服务商，或先关闭该功能。` });
      }
      continue;
    }
    if (provider.enabled !== true) {
      const shortId = typeof provider.id === "string" ? provider.id.slice(0, 6) : "";
      const name = typeof provider.name === "string" && provider.name.trim() ? provider.name : `OpenAI 兼容 · ${shortId}`;
      issues.push({ path: providerPath, message: `「${name}」未启用，请在服务商列表中打开它的开关后再保存。` });
      continue;
    }
    const modelPath = `${assignment.path}.model`;
    const model = readValue(document, modelPath);
    if (!(typeof model === "string" && model.trim()) && !(typeof provider.defaultModel === "string" && provider.defaultModel.trim())) {
      issues.push({ path: modelPath, message: `请填写${assignment.label}模型，或为所选服务商设置默认模型。` });
    }
  }
}

/** 将服务商列表转换为模型分配的可选值。 */
export function providerChoices(root: OptionDocument) {
  const providers = Array.isArray(root.providers) ? root.providers.filter(isDocument) : [];
  return providers.flatMap(provider => typeof provider.id === "string"
    ? [{ value: provider.id, label: typeof provider.name === "string" && provider.name ? provider.name : provider.id }]
    : []);
}
