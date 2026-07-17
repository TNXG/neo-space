import { request } from "~/utils/request";

export interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T | null;
}

export interface MeilisearchIndex {
  uid: string;
  primaryKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeilisearchIndexList {
  results: MeilisearchIndex[];
  total: number;
  offset: number;
  limit: number;
}

export interface MeilisearchDocumentList {
  results: Array<Record<string, unknown>>;
  total: number;
  offset: number;
  limit: number;
}

export interface MeilisearchTask {
  uid: number;
  indexUid?: string;
  status: "enqueued" | "processing" | "succeeded" | "failed" | "canceled";
  type: string;
  canceledBy?: number;
  details?: Record<string, unknown>;
  error?: Record<string, unknown>;
  enqueuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  duration?: string;
}

export interface MeilisearchTaskList {
  results: MeilisearchTask[];
  total: number;
  limit: number;
  from?: number;
  next?: number;
}

export interface MeilisearchOverview {
  health: { status: string };
  version: { pkgVersion: string; commitSha: string; commitDate: string };
  stats: {
    databaseSize: number;
    usedDatabaseSize?: number;
    lastUpdate?: string;
    indexes: Record<string, { numberOfDocuments: number; isIndexing: boolean }>;
  };
}

export interface SearchMaintenanceTask {
  _id: string;
  kind: "rebuild";
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  phase: string;
  progress: number;
  logs: string[];
  error?: string;
  cancelRequested: boolean;
  scheduled: boolean;
  sourceTaskId?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface SearchMaintenanceSchedule {
  _id: string;
  enabled: boolean;
  intervalHours: number;
  nextRunAt?: string;
  updatedAt: string;
}

export interface SearchSyncEvent {
  _id: string;
  entityType: "posts" | "notes";
  refId: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  attempts: number;
  lastError?: string;
  nextAttemptAt: string;
  createdAt: string;
  updatedAt: string;
}

/** 解包统一 API 响应。 */
const unwrap = <T>(response: ApiResponse<T>): T => {
  if (response.data === null)
    throw new Error(response.message || "Meilisearch 返回空数据");
  return response.data;
};

/** 发送并解包 GET 请求。 */
const get = async <T>(path: string): Promise<T> =>
  unwrap(await request.get<ApiResponse<T>>(path, { bypassTransform: true }));

export const meilisearchApi = {
  getOverview: () => get<MeilisearchOverview>("/admin/meilisearch/overview"),
  getIndexes: () => get<MeilisearchIndexList>("/admin/meilisearch/indexes"),
  createIndex: async (uid: string, primaryKey?: string) =>
    unwrap(await request.post<ApiResponse<MeilisearchTask>, { uid: string; primaryKey?: string }>(
      "/admin/meilisearch/indexes",
      { data: { uid, primaryKey }, bypassTransform: true },
    )),
  deleteIndex: async (uid: string) =>
    unwrap(await request.delete<ApiResponse<MeilisearchTask>>(
      `/admin/meilisearch/indexes/${uid}`,
      { bypassTransform: true },
    )),
  getDocuments: (uid: string, offset = 0, limit = 50, filter = "") =>
    get<MeilisearchDocumentList>(
      `/admin/meilisearch/indexes/${uid}/documents?offset=${offset}&limit=${limit}&filter=${encodeURIComponent(filter)}`,
    ),
  upsertDocuments: async (uid: string, documents: Record<string, unknown>[]) =>
    unwrap(await request.post<ApiResponse<MeilisearchTask>, Record<string, unknown>[]>(
      `/admin/meilisearch/indexes/${uid}/documents`,
      { data: documents, bypassTransform: true },
    )),
  deleteDocument: async (uid: string, documentId: string) =>
    unwrap(await request.delete<ApiResponse<MeilisearchTask>>(
      `/admin/meilisearch/indexes/${uid}/documents/${encodeURIComponent(documentId)}`,
      { bypassTransform: true },
    )),
  exportDocuments: (uid: string) =>
    get<MeilisearchDocumentList>(`/admin/meilisearch/indexes/${uid}/documents/export`),
  getSettings: (uid: string) =>
    get<Record<string, unknown>>(`/admin/meilisearch/indexes/${uid}/settings`),
  updateSettings: async (uid: string, settings: Record<string, unknown>) =>
    unwrap(await request.patch<ApiResponse<MeilisearchTask>, Record<string, unknown>>(
      `/admin/meilisearch/indexes/${uid}/settings`,
      { data: settings, bypassTransform: true },
    )),
  getTasks: (statuses = "") =>
    get<MeilisearchTaskList>(`/admin/meilisearch/tasks?limit=100&statuses=${encodeURIComponent(statuses)}`),
  cancelTasks: async (uids: string) =>
    unwrap(await request.post<ApiResponse<MeilisearchTask>, { uids: string }>(
      "/admin/meilisearch/tasks/cancel",
      { data: { uids }, bypassTransform: true },
    )),
  getMaintenanceTasks: () =>
    get<SearchMaintenanceTask[]>("/admin/meilisearch/maintenance/tasks"),
  getSyncEvents: () =>
    get<SearchSyncEvent[]>("/admin/meilisearch/maintenance/sync-events"),
  retrySyncEvent: async (eventId: string) =>
    unwrap(await request.post<ApiResponse<SearchSyncEvent>>(
      `/admin/meilisearch/maintenance/sync-events/${eventId}/retry`,
      { bypassTransform: true },
    )),
  createRebuild: async () =>
    unwrap(await request.post<ApiResponse<SearchMaintenanceTask>>(
      "/admin/meilisearch/maintenance/rebuild",
      { bypassTransform: true },
    )),
  retryRebuild: async (taskId: string) =>
    unwrap(await request.post<ApiResponse<SearchMaintenanceTask>>(
      `/admin/meilisearch/maintenance/tasks/${taskId}/retry`,
      { bypassTransform: true },
    )),
  cancelRebuild: async (taskId: string) =>
    unwrap(await request.post<ApiResponse<SearchMaintenanceTask>>(
      `/admin/meilisearch/maintenance/tasks/${taskId}/cancel`,
      { bypassTransform: true },
    )),
  getSchedule: () =>
    get<SearchMaintenanceSchedule>("/admin/meilisearch/maintenance/schedule"),
  updateSchedule: async (enabled: boolean, intervalHours: number) =>
    unwrap(await request.put<ApiResponse<SearchMaintenanceSchedule>, { enabled: boolean; intervalHours: number }>(
      "/admin/meilisearch/maintenance/schedule",
      { data: { enabled, intervalHours }, bypassTransform: true },
    )),
};
