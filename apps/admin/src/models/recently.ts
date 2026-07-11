import type { EnrichmentResult } from "./enrichment";

export enum RecentlyRefTypes {
  Post = "post",
  Note = "note",
  Page = "page",
  Recently = "recently",
}

export interface RecentlyRefType {
  title: string;
  url: string;
}

export interface RecentlyModel {
  _id: string;
  content: string;
  created: string;
  modified?: string | null;

  ref?: RecentlyRefType & { [key: string]: any };
  ref_id?: string;
  refType?: RecentlyRefTypes;

  enrichments?: Record<string, EnrichmentResult>;

  up: number;
  down: number;

  allowComment: boolean;
  commentsIndex?: number;
}
