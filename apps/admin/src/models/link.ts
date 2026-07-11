import type { PaginateResult } from "./base";

export enum LinkType {
  Friend,
  Collection,
}

export enum LinkState {
  Pass,
  Audit,
  Outdate,
  Banned,
  Rejected,
}

export interface LinkModel {
  _id: string;
  created: string;
  name: string;
  url: string;
  avatar: string;
  description?: string;
  type: LinkType;
  state: LinkState;
  email?: string | null;
  rssurl?: string | null;
  techstack?: string[] | null;
  health?: LinkHealthStatus | null;
}

export type LinkResponse = PaginateResult<LinkModel>;

export interface LinkHealthStatus {
  link_id: string;
  url: string;
  is_alive: boolean;
  status_code?: number;
  latency_ms?: number;
  hosting_provider: string;
  checked_at: string;
  error_message?: string;
  is_stale: boolean;
}

export interface LinkStateCount {
  audit: number;
  pass: number;
  outdate: number;
  banned: number;
  rejected: number;
}

export const LinkStateNameMap: Record<keyof typeof LinkState, string> = {
  Audit: "待审核",
  Pass: "通过",
  Outdate: "过时",
  Banned: "屏蔽",
  Rejected: "不通过",
};
