import type { SearchNoteResult, SearchPostResult } from "@/types/api";

/** 统一搜索结果项 */
export type SearchItem
  = | { type: "post"; data: SearchPostResult }
    | { type: "note"; data: SearchNoteResult };
