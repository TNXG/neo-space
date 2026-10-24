import type { OptionDocument } from "@/types/api";
import type { OptionField, OptionGroup } from "./option-schema";
import { isOptionDocument, readOption } from "./option-values";

/** 检查选择器必填项和数组字段，避免删除或重命名留下失效引用。 */
export function validateOptionGroup(group: OptionGroup, document: OptionDocument): string | undefined {
  for (const section of group.sections) {
    const error = validateFields(section.fields, document);
    if (error) return error;
  }
  const entries = Array.isArray(document.providers) ? document.providers.filter(isOptionDocument) : [];
  if (group.key === "ai" || group.key === "oauth") {
    const key = group.key === "ai" ? "id" : "type";
    const identities = entries.map(entry => entry[key]);
    if (new Set(identities).size !== identities.length) return "服务商标识重复，请为每个服务商配置唯一标识。";
  }
  if (group.key !== "ai") return;
  for (const usage of ["summaryModel", "translationModel", "commentReviewModel"]) {
    const providerId = readOption(document, `${usage}.providerId`);
    if (providerId && !entries.some(entry => entry.id === providerId)) return "模型引用的服务商已被移除或重命名，请重新选择服务商或清除该分配。";
  }
  for (const [enabled, usage] of [["enableSummary", "summaryModel"], ["enableTranslation", "translationModel"]]) {
    if (document[enabled] !== true) continue;
    if (entries.length === 0) {
      if (!document.openAiEndpoint || !document.openAiPreferredModel) return "启用 AI 功能前，请配置服务商或填写无服务商列表时的接口地址和模型。";
      continue;
    }
    const selected = readOption(document, `${usage}.providerId`);
    const provider = entries.find(entry => entry.id === selected) ?? entries.find(entry => entry.enabled === true);
    if (!provider || provider.enabled !== true) return "启用 AI 功能前，请分配已启用的服务商。";
    if (!readOption(document, `${usage}.model`) && !provider.defaultModel) return "启用 AI 功能前，请填写用途模型或服务商默认模型。";
  }
}

/** 遍历声明字段，不校验或丢弃未参与本轮维护的未知属性。 */
function validateFields(fields: readonly OptionField[], document: OptionDocument): string | undefined {
  for (const field of fields) {
    const value = readOption(document, field.path);
    if (field.required && (value === undefined || value === null || value === "")) return `请填写${field.label}。`;
    if (field.type === "select" && typeof value === "string" && value && field.choices && !field.choices.some(choice => choice.value === value)) return `${field.label}不受当前后端支持，请重新选择。`;
    if (field.type === "object-list" && Array.isArray(value)) {
      for (const entry of value) {
        if (!isOptionDocument(entry)) continue;
        const error = validateFields(field.fields ?? [], entry);
        if (error) return error;
      }
    }
  }
}
