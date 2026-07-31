"use client";

import type { BangumiMediaCollection } from "@/types/bangumi";
import { AnimatePresence } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MediaCollectionDetail } from "./MediaCollectionDetail";

interface MediaCollectionMobileDetailProps {
  item: BangumiMediaCollection;
  statusLabel: string;
  progress: string | null;
  locale: string;
  reduceMotion: boolean | null;
  open: boolean;
  onClose: () => void;
}

/** 通过 Portal 将移动详情挂到页面根节点，避免祖先 transform 改变固定定位坐标系。 */
export function MediaCollectionMobileDetail({
  item,
  statusLabel,
  progress,
  locale,
  reduceMotion,
  open,
  onClose,
}: MediaCollectionMobileDetailProps) {
  const t = useTranslations("bangumi");
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!portalReady) {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <button
            type="button"
            aria-label={t("detail.close")}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-pointer bg-foreground/20 backdrop-blur-sm lg:hidden"
          />
          <MediaCollectionDetail
            item={item}
            statusLabel={statusLabel}
            progress={progress}
            locale={locale}
            reduceMotion={reduceMotion}
            mobile
            onClose={onClose}
          />
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
