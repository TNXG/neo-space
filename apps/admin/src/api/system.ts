import { request } from '~/utils/request'

export interface AppInfo {
  name: string
  version: string
  hash?: string
}

export interface DebugEventData {
  type: string
  payload: any
}

export interface PtyRecord {
  id: string
  data: any
}

export const systemApi = {
  // 获取应用信息
  getAppInfo: () => request.get<AppInfo>('/'),

  // === Debug ===

  // 发送调试事件
  sendDebugEvent: (data: DebugEventData) =>
    request.post<void>('/debug/events', { data }),

  // 执行 Serverless 函数
  executeFunction: (data: { code: string; context?: any }) =>
    request.post<any>('/debug/function', { data }),

  // === PTY ===

  // 获取 PTY 记录
  getPtyRecords: () => request.get<PtyRecord[]>('/pty/record'),

  // === 内置函数 ===

  // 执行内置函数
  callBuiltInFunction: (name: string, params?: Record<string, any>) =>
    request.get<any>(`/fn/built-in/${name}`, { params }),

  // 获取函数类型定义
  getFnTypes: () => request.get<string>('/fn/types'),
}
