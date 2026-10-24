import type { OptionDocument, OptionValue } from "@/types/api";

/** JSON 对象检查，用于拒绝不兼容数据而不是静默覆盖它。 */
export function isOptionDocument(value: unknown): value is OptionDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 读取点分隔的真实配置字段，缺失与空值保持不同。 */
export function readOption(document: OptionDocument, path: string): OptionValue | undefined {
  let value: OptionValue | undefined = document;
  for (const part of path.split(".")) {
    if (!isOptionDocument(value)) return undefined;
    value = value[part];
  }
  return value;
}

/** 不修改原快照；undefined 表示明确删除字段，空字符串和空数组保留。 */
export function writeOption(document: OptionDocument, path: string, value: OptionValue | undefined): OptionDocument {
  const [head, ...tail] = path.split(".");
  const result = { ...document };
  if (tail.length) result[head] = writeOption(isOptionDocument(document[head]) ? document[head] : {}, tail.join("."), value);
  else if (value === undefined) delete result[head];
  else result[head] = value;
  return result;
}

/** 忽略对象键顺序，对嵌套配置与有序数组比较实际数据。 */
export function sameOptionValue(left: OptionValue | undefined, right: OptionValue | undefined): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => sameOptionValue(value, right[index]));
  if (!isOptionDocument(left) || !isOptionDocument(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && sameOptionValue(left[key], right[key]));
}

/** 错误仅使用 API 消息；不序列化含有密钥的请求或配置。 */
export function optionError(error: unknown): string {
  return error instanceof Error ? error.message : "请求失败，请检查连接后重试。";
}
