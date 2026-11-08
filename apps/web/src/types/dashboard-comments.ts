import type { UAInfo } from "./api";

/** Owner list states: unread/read are public normal comments, pending is withheld. */
export type DashboardCommentState = 0 | 1 | 2 | 3;

/** Exact camelCase projection returned by owner GET /comments without ref. */
export interface DashboardComment {
  _id: string;
  createdAt: string;
  ref: string;
  refType: string;
  state: DashboardCommentState;
  author: string;
  text: string;
  mail: string | null;
  url: string | null;
  ip: string | null;
  agent: string | null;
  pin: boolean;
  avatar: string | null;
  isWhispers: boolean;
  parentCommentId: string | null;
  parent: { _id: string; author: string | null; text: string; isDeleted: boolean } | null;
  rootCommentId: string | null;
  replyCount: number;
  latestReplyAt: string | null;
  isDeleted: boolean;
  anchor: { title: string | null; slug: string | null; categorySlug: string | null; nid: number | null; path: string } | null;
}

/** Owner identity is derived from the authenticated Cookie, never submitted by the browser. */
export interface DashboardCommentReply {
  ref: string;
  refType: "posts" | "pages" | "notes";
  parent: string;
  text: string;
  ua?: UAInfo;
}
