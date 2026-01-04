import { use } from "react";
import { CommentContext } from "./context";

/**
 * 使用评论高亮功能的 Hook
 */
export function useCommentHighlight() {
  const context = use(CommentContext);
  if (!context) {
    throw new Error("useCommentHighlight must be used within a CommentProvider");
  }
  return context;
}

/**
 * 使用评论刷新功能的 Hook
 */
export function useCommentRefresh() {
  const context = use(CommentContext);
  if (!context) {
    throw new Error("useCommentRefresh must be used within a CommentProvider");
  }
  return {
    refreshComments: context.refreshComments,
    setRefreshComments: context.setRefreshComments,
  };
}

/**
 * CommentForm 工具函数
 */

/**
 * 从 OwO 数据构建表情映射表
 * @param owoData OwO 表情包数据
 * @returns 表情名到 URL 的映射
 */
export function buildOwOEmojiMap(owoData: Record<string, any>): Record<string, string> {
  const map: Record<string, string> = {};

  Object.values(owoData).forEach((pkg: any) => {
    if (pkg.container && Array.isArray(pkg.container)) {
      pkg.container.forEach((item: any) => {
        if (item.text && item.icon) {
          map[item.text] = item.icon;
        }
      });
    }
  });

  return map;
}

/**
 * 解析评论内容中的 OwO 表情语法
 * 将 :表情名: 转换为图片标签
 * @param content 评论内容
 * @param emojiMap 表情映射表
 * @returns 解析后的内容
 */
export function parseOwOEmojis(content: string, emojiMap: Record<string, string>): string {
  // 匹配 :表情名: 格式
  return content.replace(/:([^:\s]+):/g, (match, emojiName) => {
    const url = emojiMap[emojiName];
    if (url) {
      return `![${emojiName}](${url})`;
    }
    return match; // 如果找不到对应表情，保持原样
  });
}
