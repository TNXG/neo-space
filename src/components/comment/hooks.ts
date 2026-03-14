import { use } from "react";
import { CommentContext } from "./context";

// Static regex patterns to avoid re-compilation
const OWO_EMOJI_REGEX = /\[([^\s[\]]+)\]/g;

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
 * @returns 表情名到 URL 的映射，格式为 "族名_表情名" => URL
 */
export function buildOwOEmojiMap(owoData: Record<string, any>): Record<string, string> {
  const map: Record<string, string> = {};

  Object.entries(owoData).forEach(([pkgName, pkg]: [string, any]) => {
    if (pkg.container && Array.isArray(pkg.container)) {
      pkg.container.forEach((item: any) => {
        if (item.text && item.icon) {
          // 使用 "族名_表情名" 作为键，防止不同族的表情重名
          const key = `${pkgName}_${item.text}`;
          map[key] = item.icon;
        }
      });
    }
  });

  return map;
}

/**
 * 解析评论内容中的 OwO 表情语法
 * 将 [族名_表情名] 转换为图片标签
 * @param content 评论内容
 * @param emojiMap 表情映射表
 * @returns 解析后的内容
 */
export function parseOwOEmojis(content: string, emojiMap: Record<string, string>): string {
  // 匹配 [族名_表情名] 格式
  // 匹配方括号内的非空白、非方括号字符
  return content.replace(OWO_EMOJI_REGEX, (match, emojiKey) => {
    const url = emojiMap[emojiKey];
    if (url) {
      // 提取表情名（去掉族名前缀）用于 alt 文本
      const emojiName = emojiKey.includes("_") ? emojiKey.split("_").slice(1).join("_") : emojiKey;
      return `![${emojiName}](${url})`;
    }
    return match; // 如果找不到对应表情，保持原样
  });
}
