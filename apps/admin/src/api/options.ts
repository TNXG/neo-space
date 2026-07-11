import { request } from "~/utils/request";

export type OptionValue
  = | null
    | boolean
    | number
    | string
    | OptionValue[]
    | { [key: string]: OptionValue };

export type SystemOptions = Record<string, OptionValue>;

interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T | null;
}

async function unwrapResponse<T>(requestPromise: Promise<ApiResponse<T>>): Promise<T> {
  const response = await requestPromise;
  if (response.data === null) {
    throw new Error(response.message || "配置数据为空");
  }
  return response.data;
}

export const optionsApi = {
  /** 读取 options 集合中的全部配置文档。 */
  getAll: () =>
    unwrapResponse(
      request.get<ApiResponse<SystemOptions>>("/options", {
        bypassTransform: true,
      }),
    ),

  /** 读取单个配置文档的 value。 */
  get: <T>(key: string) =>
    unwrapResponse(
      request.get<ApiResponse<T>>(`/options/${key}`, { bypassTransform: true }),
    ),

  // 获取 URL 配置
  getUrl: () =>
    unwrapResponse(
      request.get<ApiResponse<{
      webUrl: string;
      serverUrl: string;
      }>>("/options/url", { bypassTransform: true }),
    ),

  /** 以 options 集合现有 name 原样回写 value。 */
  patch: <T extends OptionValue>(key: string, data: T) =>
    unwrapResponse(
      request.patch<ApiResponse<T>, T>(`/options/${key}`, {
        data,
        bypassTransform: true,
      }),
    ),

  /** 完整替换一个配置文档，用于可视化表单保存。 */
  replace: <T extends OptionValue>(key: string, data: T) =>
    unwrapResponse(
      request.put<ApiResponse<T>, T>(`/options/${key}`, {
        data,
        bypassTransform: true,
      }),
    ),
};
