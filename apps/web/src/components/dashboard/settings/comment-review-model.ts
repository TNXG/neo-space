import type { OptionDocument } from "@/types/api";
import { providerLabel, readProviders } from "./ai-model";
import { readValue } from "./settings-model";

/** 解析已保存的模型分配；评论审核永不偷偷回退到其他服务商。 */
export function resolveCommentReview(ai: OptionDocument | undefined) {
  if (!ai) return { ready: false, reason: "正在读取 AI 服务配置…" };
  const providerId = readValue(ai, "commentReviewModel.providerId");
  const provider = readProviders(ai).find(item => item.id === providerId);
  if (!provider) return { ready: false, reason: "请先在「AI 服务」中为评论审核指定服务商。" };
  const label = providerLabel(provider);
  if (provider.enabled !== true) return { ready: false, reason: `所选服务商「${label}」尚未启用。` };
  if (!["openai", "openai-compatible", "jev"].includes(provider.type ?? "")) return { ready: false, reason: "所选服务商不支持评论审核。" };
  if (!provider.endpoint?.trim()) return { ready: false, reason: `请为「${label}」填写接口地址。` };
  if (provider.type === "jev" && !provider.apiKey?.trim()) return { ready: false, reason: `请为「${label}」填写 API 密钥。` };
  const selectedModel = readValue(ai, "commentReviewModel.model");
  const model = typeof selectedModel === "string" && selectedModel.trim() ? selectedModel.trim() : provider.defaultModel?.trim();
  if (!model) return { ready: false, reason: `请为评论审核填写模型名称，或为「${label}」设置默认模型。` };
  return { ready: true, reason: `${label} · ${model}`, provider, model };
}
