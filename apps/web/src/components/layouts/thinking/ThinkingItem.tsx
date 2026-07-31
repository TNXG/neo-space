import type { Recently } from "@/types/api";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { SmartDate } from "@/components/common/smart-date";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

// Static regex patterns to avoid re-compilation
const ICON_PATTERN_REGEX = /^:::(\w+):::/;
const ICON_PREFIX_REGEX = /^:::\w+:::/;

interface ThinkingItemProps {
  item: Recently;
}

/**
 * 单条碎碎念组件 (Server Component)
 * 由于包含了 async 的 MarkdownRenderer，必须在服务端运行
 */
export async function ThinkingItem({ item }: ThinkingItemProps) {
  // 解析图标（如果有）
  const iconMatch = item.content.match(ICON_PATTERN_REGEX);
  const iconName = iconMatch?.[1];
  const content = iconMatch ? item.content.replace(ICON_PREFIX_REGEX, "").trim() : item.content;

  return (
    <article
      className={cn(
        "relative group",
        "border-l-2 border-primary-200 pl-6 pb-2",
        "hover:border-accent-400 transition-colors duration-200",
      )}
    >
      {/* 时间线节点 */}
      <div className="absolute left-0 top-6 -translate-x-1/2 w-4 h-4 rounded-full bg-primary-200 group-hover:bg-accent-400 transition-colors duration-200 shadow-sm" />

      {/* 元信息 */}
      <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
        <Icon
          icon={iconName === "mood" ? "mingcute:emoji-line" : iconName === "weather" ? "mingcute:cloud-line" : "mingcute:time-line"}
          className="w-4 h-4"
        />
        <SmartDate date={item.created} className="font-mono text-muted-foreground" />

        {(item.up > 0 || item.down > 0) && (
          <>
            <span className="text-muted-foreground/50">·</span>
            <span className={cn("flex items-center gap-1", item.up > item.down ? "text-green-600" : item.down > item.up ? "text-red-500" : "text-muted-foreground")}>
              <Icon icon={item.up > item.down ? "mingcute:thumb-up-line" : "mingcute:thumb-down-line"} className="w-3.5 h-3.5" />
              {item.up > item.down ? item.up : item.down}
            </span>
          </>
        )}
      </div>

      {/* Markdown 内容 */}
      <div className="prose prose-primary max-w-none">
        <MarkdownRenderer content={content} />
      </div>

      {/* 关联引用 */}
      {item.ref_id && item.refType && (
        <div className="mt-4 pt-3 border-t border-dashed border-primary-200">
          <a
            href={`/${item.refType === "post" ? "posts" : item.refType === "note" ? "notes" : ""}/${item.ref_id}`}
            className="inline-flex items-center gap-1.5 text-xs text-accent-600 hover:text-accent-700 transition-colors"
          >
            <Icon icon="mingcute:link-line" className="w-3.5 h-3.5" />
            引用关联内容
          </a>
        </div>
      )}
    </article>
  );
}
