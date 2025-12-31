import type { TimeCapsuleResponse } from "@/types/api";
import { Icon } from "@iconify/react/offline";
import { getTimeCapsule } from "@/lib/api-client";

interface OutdatedAlertProps {
  /** 文章 ID */
  refId: string;
  /** 关联类型 */
  refType?: "post" | "note" | "page";
  /** 最后更新时间 (ISO Date string) */
  lastUpdated: string;
  /** 当前日期（用于测试，可选） */
  currentDate?: Date;
  /** 过期阈值（天数），默认 365 天 */
  threshold?: number;
  /** 额外的 CSS 类名 */
  className?: string;
}

/**
 * 文章过期提示组件 - 服务端版本
 * 在服务端获取 AI 分析结果，避免客户端抖动
 */
export async function OutdatedAlert({
  refId,
  refType = "post",
  lastUpdated,
  currentDate,
  threshold = 365,
  className = "",
}: OutdatedAlertProps) {
  // 计算时间差
  const now = currentDate ?? new Date();
  const updated = new Date(lastUpdated);
  const diffTime = Math.abs(now.getTime() - updated.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const isOutdated = diffDays > threshold;

  // 尝试获取已有的 AI 分析结果
  let capsule: TimeCapsuleResponse | null = null;
  try {
    const response = await getTimeCapsule(refId);
    if (response.status === "success" && response.data) {
      capsule = response.data;
    }
  } catch {
    // 静默失败 - 没有分析结果或服务不可用
  }

  // 判断是否显示：时间过期 或 AI 判断为高时效性内容
  const shouldShow = isOutdated; // || capsule?.sensitivity === "high";

  if (!shouldShow) {
    return null;
  }

  // 避免使用未使用的变量警告
  void refType;

  // 计算时间描述
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const timeDesc = years > 0
    ? `${years} 年${months > 0 ? ` ${months} 个月` : ""}`
    : `${months} 个月`;

  // AI 分析的敏感度标签
  const sensitivityLabel = capsule?.sensitivity === "high"
    ? "易过期内容"
    : capsule?.sensitivity === "medium"
      ? "部分时效内容"
      : capsule?.sensitivity === "low"
        ? "长期有效内容"
        : null;

  return (
    <div className={`w-full max-w-3xl mx-auto my-8 ${className}`}>
      {/* 外层虚线边框容器 */}
      <div className="relative overflow-hidden rounded-xl border border-dashed border-primary-300 bg-primary-100/50 backdrop-blur-sm p-1">
        {/* 内层实线容器 */}
        <div className="relative overflow-hidden rounded-lg bg-white/60 border border-primary-200 p-5 md:p-6">
          {/* 背景水印 */}
          <div className="absolute -right-6 -bottom-8 text-primary-400/10 pointer-events-none select-none z-0">
            <Icon
              icon="mingcute:sandglass-line"
              width={160}
              height={160}
              className="transform -rotate-12"
            />
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            {/* 左侧图标 */}
            <div className="shrink-0">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary-200 text-primary-600 border border-primary-300 shadow-sm">
                <Icon icon="mingcute:sandglass-line" width={24} height={24} />
              </div>
            </div>

            {/* 右侧文本 */}
            <div className="flex-1 space-y-2">
              {/* 标签 */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary-200 text-primary-700 border border-primary-300">
                  Time Capsule
                </span>
                {sensitivityLabel && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                    capsule?.sensitivity === "high"
                      ? "bg-amber-100 text-amber-700"
                      : capsule?.sensitivity === "low"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                  }`}
                  >
                    {sensitivityLabel}
                  </span>
                )}
              </div>

              {/* 标题 */}
              {isOutdated
                ? (
                    <h4 className="text-base font-bold text-foreground">
                      本文最后更新于
                      {" "}
                      <span className="text-accent-600 border-b-2 border-accent-300">
                        {timeDesc}
                      </span>
                      {" "}
                      前
                    </h4>
                  )
                : (
                    <h4 className="text-base font-bold text-foreground">
                      此文章包含时效性内容
                    </h4>
                  )}

              {/* AI 分析理由 */}
              {capsule?.reason
                ? (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                      {capsule.reason}
                    </p>
                  )
                : (
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                      文中涉及的技术方案、API 或最佳实践可能已经发生演变。
                      <span className="hidden sm:inline">
                        建议在阅读时结合最新的官方文档或社区动态进行验证。
                      </span>
                    </p>
                  )}

              {/* AI 检测到的易过期元素 */}
              {capsule?.markers && capsule.markers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {capsule.markers.map(marker => (
                    <span
                      key={marker}
                      className="px-2 py-0.5 rounded text-xs bg-primary-200/80 text-primary-700"
                    >
                      {marker}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
