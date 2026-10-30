"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { ContentMeta } from "@/types/api";
import { getImageMetadata } from "@/utils/images/common";

const ImageMetadataContext = createContext<ContentMeta | null | undefined>(undefined);

/** Make saved article metadata available to images, including images rebuilt by container components. */
export function ImageMetadataProvider({ meta, children }: { meta?: ContentMeta | null; children: ReactNode }) {
  return <ImageMetadataContext value={meta}>{children}</ImageMetadataContext>;
}

/** Resolve an image from the saved document table without fetching or scanning during rendering. */
export function useImageMetadata(src: string) {
  return getImageMetadata(useContext(ImageMetadataContext), src);
}
