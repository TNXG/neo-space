import type { OptionDocument, OptionValue } from "@/types/api";

/** 判断后端配置值是否为可编辑的 JSON 对象，数组不在此列。 */
export function isDocument(value: unknown): value is OptionDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取点分隔路径；缺失与显式空值保持区别。 */
export function readValue(document: OptionDocument, path: string): OptionValue | undefined {
  let current: OptionValue | undefined = document;
  for (const key of path.split(".")) {
    if (!isDocument(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** 不修改原快照写入路径；undefined 表示删除该键。 */
export function writeValue(document: OptionDocument, path: string, value: OptionValue | undefined): OptionDocument {
  const [head, ...rest] = path.split(".");
  const next = { ...document };
  if (rest.length) next[head] = writeValue(isDocument(document[head]) ? document[head] : {}, rest.join("."), value);
  else if (value === undefined) delete next[head];
  else next[head] = value;
  return next;
}

/** 忽略对象键顺序比较配置，数组保持顺序敏感。 */
export function sameValue(left: OptionValue | undefined, right: OptionValue | undefined): boolean {
  if (left === right) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => sameValue(item, right[index]));
  }
  if (!isDocument(left) || !isDocument(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}

/** 只透出接口消息，避免把凭据或请求体拼进提示。 */
export function failureMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "请求失败，请检查连接后重试。";
}

/** 供界面按字段定位的校验结果。 */
export interface SettingsIssue {
  path: string;
  message: string;
}
