import type { Pager } from "./base";

export enum EnumPageType {
  md = "md",
  html = "html",
  frame = "frame",
}
export interface PageModel {
  _id: string;
  created: string;
  modified?: string | null;
  createdAt: string;
  modifiedAt: string | null;
  /** Slug */
  slug: string;

  /** Title */
  title: string;

  /** SubTitle */
  subtitle?: string;

  /** Order */
  order?: number;

  /** Text */
  text: string;

  contentFormat?: "markdown" | "lexical";
  content?: string;

  /** Type (MD | html | frame) */
  type?: EnumPageType;

  /** Other Options */
  options?: object;

  meta?: Record<string, unknown>;
  allowComment?: boolean;
  commentsIndex?: number;
}

export interface PageResponse {
  data: PageModel[];
  pagination: Pager;
}
