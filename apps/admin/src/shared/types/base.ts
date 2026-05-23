import type { Image } from "~/models/base";

export type ContentFormat = "markdown" | "lexical";

export interface WriteBaseType {
  title: string;
  text: string;
  contentFormat?: ContentFormat;
  content?: string;

  id?: string;
  images: Image[];
  createdAt?: string;
  modifiedAt?: string;

  meta?: any;
}
