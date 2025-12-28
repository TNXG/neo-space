import { SmartDate } from "@/components/common/smart-date";

interface NoteHeaderProps {
  title: string;
  nid: number;
  created: string;
  modified?: string;
  mood?: string;
  weather?: string;
  location?: string;
}

/**
 * 日记头部组件
 * 显示标题、日期、心情、天气、地点等元信息
 */
export function NoteHeader({
  title,
  nid,
  created,
  modified,
  mood,
  weather,
  location,
}: NoteHeaderProps) {
  return (
    <header className="mb-12 pb-8 border-b border-border/50">
      {/* 类型标签 */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
          Note
        </span>
        <span className="text-xs text-muted-foreground/60">
          #
          {nid}
        </span>
      </div>

      {/* 标题 */}
      <h1 className="text-3xl lg:text-5xl font-bold text-foreground mb-6 leading-tight tracking-tight">
        {title}
      </h1>

      {/* 元信息 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        {/* 发布日期 */}
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/60">记录于</span>
          <SmartDate date={created} />
        </span>

        {/* 更新日期 */}
        {modified && modified !== created && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">·</span>
            <span className="text-muted-foreground/60">更新于</span>
            <SmartDate date={modified} />
          </span>
        )}
      </div>

      {/* 日记特有元信息：心情、天气、地点 */}
      {(mood || weather || location) && (
        <div className="flex flex-wrap gap-3 mt-4">
          {mood && (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground">
              <span>💭</span>
              {mood}
            </span>
          )}
          {weather && (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground">
              <span>🌤</span>
              {weather}
            </span>
          )}
          {location && (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/30 text-accent-foreground">
              <span>📍</span>
              {location}
            </span>
          )}
        </div>
      )}
    </header>
  );
}
