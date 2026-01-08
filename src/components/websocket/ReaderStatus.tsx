"use client";

import type { ReadingItem } from "@/hooks/use-reader-websocket";
import { Icon } from "@iconify/react/offline";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { usePageContext } from "@/contexts/PageContext";
import { useReaderWebSocket } from "@/hooks/use-reader-websocket";

export function ReaderStatus() {
  const { pageInfo } = usePageContext();
  const {
    isConnected,
    onlineCount,
    currentPageReaders,
    readingList,
    enterPage,
    leavePage,
  } = useReaderWebSocket();

  const [showReadingList, setShowReadingList] = useState(false);

  // 进入/离开页面
  useEffect(() => {
    if (pageInfo) {
      enterPage(pageInfo.pageType, pageInfo.pageId, pageInfo.pageTitle);
      return () => {
        leavePage();
      };
    }
  }, [pageInfo, enterPage, leavePage]);

  // 过滤掉当前页面
  const otherReadingList = readingList.filter(
    item => !(pageInfo && item.page_type === pageInfo.pageType && item.page_id === pageInfo.pageId),
  );

  const getPageUrl = (item: ReadingItem) => {
    switch (item.page_type) {
      case "post":
        return `/posts/${item.page_id}`;
      case "note":
        return `/notes/${item.page_id}`;
      case "page":
        return `/pages/${item.page_id}`;
      default:
        return "#";
    }
  };

  const getPageTypeLabel = (type: string) => {
    switch (type) {
      case "post":
        return "文章";
      case "note":
        return "笔记";
      case "page":
        return "页面";
      default:
        return "内容";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* 在线状态卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4 min-w-[180px] shadow-glass"
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            {isConnected
              ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500" />
                  </>
                )
              : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-400" />
                )}
          </span>
          <span className="text-sm font-medium text-foreground">
            {isConnected ? "已连接" : "未连接"}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Icon icon="mingcute:group-line" className="text-base" />
              在线人数
            </span>
            <span className="font-medium text-foreground tabular-nums">{onlineCount}</span>
          </div>

          {pageInfo && currentPageReaders > 0 && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Icon icon="mingcute:eye-line" className="text-base" />
                当前阅读
              </span>
              <span className="font-medium text-foreground tabular-nums">{currentPageReaders}</span>
            </div>
          )}
        </div>

        {/* 其他读者正在阅读 */}
        {otherReadingList.length > 0 && (
          <button
            type="button"
            onClick={() => setShowReadingList(!showReadingList)}
            className="mt-3 w-full text-xs text-accent-600 hover:text-accent-700 transition-colors text-left flex items-center gap-1"
          >
            <Icon
              icon="mingcute:arrow-right-line"
              className={`text-sm transition-transform ${showReadingList ? "rotate-90" : ""}`}
            />
            {showReadingList ? "隐藏" : "查看"}
            其他读者 (
            {otherReadingList.length}
            )
          </button>
        )}
      </motion.div>

      {/* 其他读者正在阅读的列表 */}
      <AnimatePresence>
        {showReadingList && otherReadingList.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="glass-card p-4 max-w-[280px] shadow-glass max-h-[360px] overflow-y-auto toc-scrollbar"
          >
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Icon icon="mingcute:book-2-line" className="text-base text-accent-600" />
              其他读者正在阅读
            </h3>
            <div className="space-y-2">
              {otherReadingList.map(item => (
                <Link
                  key={`${item.page_type}-${item.page_id}`}
                  href={getPageUrl(item)}
                  className="block p-2.5 rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] text-muted-foreground mb-0.5 uppercase tracking-wide">
                        {getPageTypeLabel(item.page_type)}
                      </div>
                      <div className="text-sm text-foreground truncate">
                        {item.page_title || "未命名"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Icon icon="mingcute:eye-line" className="text-sm" />
                      <span className="tabular-nums">{item.reader_count}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
