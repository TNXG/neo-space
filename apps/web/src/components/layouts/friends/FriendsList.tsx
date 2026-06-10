"use client";

import type { Link } from "@/types/api";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { MagneticHoverEffect, MagneticZone } from "@/components/common/magnetic-hover-effect";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { getArchIcon, getHostingDisplayName, getHostingIcon } from "@/lib/icon";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

interface FriendsListProps {
  friends: Link[];
  collections: Link[];
}

// -----------------------------------------------------------------------------
// 工具函数
// -----------------------------------------------------------------------------

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60)
    return "刚刚";
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} 分钟前`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} 小时前`;
  return `${Math.floor(diffInSeconds / 86400)} 天前`;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getLatencyColor(ms?: number) {
  if (ms === undefined)
    return "text-muted-foreground";
  if (ms < 200)
    return "text-green-500";
  if (ms < 500)
    return "text-yellow-500";
  return "text-red-500";
}

// -----------------------------------------------------------------------------
// 子组件：Detail Card (左侧面板专用容器)
// -----------------------------------------------------------------------------

const DetailCard = ({
  children,
  className,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  style?: React.CSSProperties;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 15, scale: 0.95, filter: "blur(4px)" }}
    animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, y: 10, filter: "blur(4px)" }}
    transition={{ duration: 0.4, delay, ease: [0.2, 0.65, 0.3, 0.9] }}
    className={cn(
      "relative overflow-hidden rounded-2xl border border-border/40 bg-card/30 p-4 backdrop-blur-xl",
      className,
    )}
    style={style}
  >
    {children}
  </motion.div>
);

// -----------------------------------------------------------------------------
// 主组件
// -----------------------------------------------------------------------------

export function FriendsList({ friends, collections }: FriendsListProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<"friends" | "collections">("friends");
  const isMobile = useIsMobile();

  const items = useMemo(
    () => (activeTab === "friends" ? friends : collections),
    [activeTab, friends, collections],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const initialSelectedId = useMemo(() => {
    if (items.length > 0)
      return items[0]._id;
    return null;
  }, [items]);

  if (initialSelectedId && !selectedId) {
    setSelectedId(initialSelectedId);
  }

  const activeItem = useMemo(
    () => items.find(item => item._id === selectedId) || items[0],
    [items, selectedId],
  );

  const handleTabChange = (tab: "friends" | "collections") => {
    setActiveTab(tab);
    const newItems = tab === "friends" ? friends : collections;
    if (newItems.length > 0)
      setSelectedId(newItems[0]._id);
  };

  // -------------------------------------------------------------------------
  // 渲染预览面板
  // -------------------------------------------------------------------------
  const renderPreview = () => {
    if (!activeItem)
      return null;

    const { health } = activeItem;
    const providerName = health?.hosting_provider || "Unknown";
    const providerDisplayName = getHostingDisplayName(providerName);
    const hasHealth = Boolean(health);
    const isAlive = health?.is_alive;

    // 获取颜色主题
    const statusColor = !hasHealth
      ? "text-muted-foreground"
      : isAlive
        ? "text-green-500"
        : "text-red-500";
    const statusBg = !hasHealth
      ? "bg-muted-foreground/50"
      : isAlive
        ? "bg-green-500"
        : "bg-red-500";

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeItem._id}
          initial="initial"
          animate="animate"
          exit="exit"
          className="flex flex-col gap-4 p-1"
        >
          {/* 1. Identity & Browser Header */}
          <DetailCard className="p-0 border-0 bg-transparent overflow-visible">
            <div className="relative rounded-2xl overflow-hidden border border-border/50 bg-card">
              {/* 模拟浏览器头部 */}
              <div className="h-24 w-full bg-secondary/30 relative overflow-hidden">
                <div
                  className="absolute inset-0 opacity-30 bg-cover bg-center blur-2xl scale-125 saturate-150"
                  style={{ backgroundImage: `url(${activeItem.avatar})` }}
                />
                <div className="absolute inset-0 bg-linear-to-b from-transparent to-card" />
                <div className="absolute top-3 left-3 flex gap-1.5 z-10 opacity-70">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>
              </div>

              {/* 内容区域 */}
              <div className="relative px-5 pb-5 -mt-10 flex flex-col items-center text-center">
                <motion.div
                  layoutId={`avatar-large-${activeItem._id}`}
                  className="relative z-10 rounded-2xl p-1.5 bg-card border border-border/20 backface-hidden transform-[translateZ(0)]"
                >
                  <img
                    src={activeItem.avatar}
                    alt={activeItem.name}
                    className="w-20 h-20 rounded-xl object-cover [image-rendering:auto]"
                  />
                  <div className="absolute -bottom-2 -right-2 bg-card p-1 rounded-full">
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 border-card animate-pulse",
                        statusBg,
                      )}
                    />
                  </div>
                </motion.div>

                <div className="mt-3 w-full">
                  <motion.h2
                    layoutId={`title-${activeItem._id}`}
                    className="text-2xl font-bold tracking-tight text-foreground"
                  >
                    {activeItem.name}
                  </motion.h2>
                  <div className="flex items-center justify-center gap-1.5 mt-1 text-xs font-mono text-muted-foreground/80">
                    <Icon icon="mingcute:link-2-line" className="w-3.5 h-3.5" />
                    <span className="truncate max-w-50">
                      {new URL(activeItem.url).hostname}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </DetailCard>

          {/* 2. Primary Action */}
          <DetailCard delay={0.05} className="p-0 border-0 bg-transparent overflow-visible">
            <a
              href={activeItem.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`访问 ${activeItem.name}`}
              className="group relative flex min-h-14 cursor-pointer items-center justify-between rounded-2xl border border-border/50 bg-secondary/10 px-4 py-3 overflow-hidden"
            >
              <div
                className="absolute inset-0 opacity-40 bg-cover bg-center blur-xl scale-125 saturate-200 transition-opacity duration-300 group-hover:opacity-60"
                style={{ backgroundImage: `url(${activeItem.avatar})` }}
              />
              <div className="absolute inset-0 bg-card/80 transition-colors duration-300 group-hover:bg-card/60" />
              <div className="relative z-10 flex min-w-0 flex-col">
                <span className="text-sm font-semibold leading-tight text-foreground drop-shadow-xs">
                  访问站点
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground drop-shadow-xs">
                  <Icon icon="mingcute:mouse-line" className="w-3.5 h-3.5" />
                  鼠标左键直接打开
                </span>
              </div>
              <Icon
                icon="mingcute:external-link-line"
                className="relative z-10 h-5 w-5 text-muted-foreground transition-colors duration-200 group-hover:text-foreground drop-shadow-xs"
              />
            </a>
          </DetailCard>

          {/* 3. Monitor Dashboard */}
          <div className="grid grid-cols-2 gap-3">
            {/* Health - 边缘均匀光晕 */}
            <DetailCard
              delay={0.1}
              className="flex flex-col justify-between gap-3 border-0 bg-transparent"
              style={{
                boxShadow: isAlive
                  ? "inset 0 0 24px 8px rgba(34,197,94,0.12)"
                  : hasHealth
                    ? "inset 0 0 24px 8px rgba(239,68,68,0.12)"
                    : "inset 0 0 24px 8px rgba(100,116,139,0.08)",
              }}
            >
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider">
                  Health
                </span>
                <Icon
                  icon="mingcute:heartbeat-line"
                  className={cn("w-4 h-4", statusColor)}
                />
              </div>
              <div className="relative z-10">
                <div className="text-xl font-bold font-mono tracking-tight text-foreground">
                  {health?.status_code || (
                    hasHealth
                      ? (isAlive ? "200" : "ERR")
                      : "N/A"
                  )}
                </div>
                <div
                  className={cn(
                    "text-[10px] font-medium mt-0.5 flex items-center gap-1",
                    statusColor,
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusBg)} />
                  {!hasHealth
                    ? "Not Checked"
                    : isAlive
                      ? "System Operational"
                      : "System Error"}
                </div>
              </div>
            </DetailCard>

            <div className="flex flex-col gap-3">
              <DetailCard delay={0.15} className="py-2.5 px-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground/60">
                    Latency
                  </span>
                  <span
                    className={cn(
                      "text-sm font-mono font-bold",
                      getLatencyColor(health?.latency_ms),
                    )}
                  >
                    {health?.latency_ms ? `${health.latency_ms}ms` : "-"}
                  </span>
                </div>
                <Icon icon="mingcute:lightning-fill" className="w-4 h-4 text-yellow-500/80" />
              </DetailCard>

              <DetailCard delay={0.2} className="py-2.5 px-3 flex items-center justify-between">
                <div className="flex flex-col min-w-0">
                  <span className="text-[9px] font-bold uppercase text-muted-foreground/60">
                    Hosting
                  </span>
                  <span className="text-sm font-medium truncate" title={providerDisplayName}>
                    {providerName === "unknown" ? "N/A" : providerDisplayName}
                  </span>
                </div>
                {(() => {
                  const ProviderIcon = getHostingIcon(providerName);
                  return ProviderIcon
                    ? (
                        <ProviderIcon size={22} className="text-muted-foreground/80" />
                      )
                    : null;
                })()}
              </DetailCard>
            </div>
          </div>

          {/* 4. Description */}
          <DetailCard
            delay={0.25}
            className="min-h-20 bg-linear-to-br from-card/30 to-secondary/10"
          >
            <Icon
              icon="mingcute:quote-left-fill"
              className="absolute top-2 right-2 text-primary/10 w-12 h-12 -rotate-12 pointer-events-none"
            />
            <div className="relative z-10">
              <span className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1.5 block">
                Bio
              </span>
              <p className="text-sm leading-relaxed text-foreground/80 font-medium">
                "
                {activeItem.description || "这位朋友很神秘，没有留下介绍..."}
                "
              </p>
            </div>
            {activeItem.created && (
              <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground/50">
                <Icon icon="mingcute:time-line" className="w-3 h-3" />
                Joined
                {" "}
                {formatDate(activeItem.created)}
              </div>
            )}
          </DetailCard>

          {/* 5. Tech Stack */}
          {activeItem.techstack && activeItem.techstack.length > 0 && (
            <DetailCard delay={0.3} className="bg-transparent border-0 p-0 overflow-visible">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Icon icon="mingcute:code-line" className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Tech Stack</span>
                <div className="h-px flex-1 bg-border/50" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeItem.techstack.map((tech, i) => {
                  const TechIcon = getArchIcon(tech);
                  return (
                    <motion.div
                      key={tech}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-secondary/50 backdrop-blur-md border border-border/50 rounded-lg text-secondary-foreground cursor-default"
                    >
                      {TechIcon && <TechIcon size={12} className="opacity-70" />}
                      {tech}
                    </motion.div>
                  );
                })}
              </div>
            </DetailCard>
          )}

          {/* 6. Footer Meta */}
          <DetailCard delay={0.35} className="mt-auto p-0 border-0 bg-transparent">
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/20 p-3 text-[10px] text-muted-foreground/60">
              <Icon icon="mingcute:eye-line" className="w-3.5 h-3.5" />
              Last Check:
              {" "}
              {health?.checked_at ? formatTimeAgo(health.checked_at) : "N/A"}
            </div>
          </DetailCard>
        </motion.div>
      </AnimatePresence>
    );
  };

  // -------------------------------------------------------------------------
  // 渲染主体结构
  // -------------------------------------------------------------------------
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Tab Switcher */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center p-1.5 bg-secondary/40 backdrop-blur-xl rounded-full border border-border/40 shadow-sm">
          {(["friends", "collections"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={cn(
                "relative px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-300 ease-out",
                activeTab === tab
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/70",
              )}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 bg-background shadow-md rounded-full border border-border/20"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <Icon
                  icon={tab === "friends" ? "mingcute:group-line" : "mingcute:bookmark-line"}
                  className="w-4 h-4"
                />
                {tab === "friends" ? t("friends.tab.friends") : t("friends.tab.collections")}
                <span className="opacity-40 text-xs font-mono ml-0.5">
                  {tab === "friends" ? friends.length : collections.length}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 xl:gap-10 relative items-start">
        {/* Left: Sticky Details Panel (Desktop Only) */}
        <aside className="hidden lg:block sticky top-24 max-h-[calc(100vh-8rem)]">
          {activeItem
            ? (
                <div className="overflow-y-auto overflow-x-hidden no-scrollbar pr-1 pb-4 max-h-[calc(100vh-8rem)]">
                  {renderPreview()}
                </div>
              )
            : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground/40 bg-card/30 rounded-2xl border border-dashed border-border/50">
                  <Icon icon="mingcute:mouse-line" className="w-6 h-6 mb-2" />
                  <span className="text-sm">{t("friends.preview.empty")}</span>
                </div>
              )}
        </aside>

        {/* Right: Scrollable List Grid */}
        <div className="flex flex-col gap-6 min-w-0">
          <MagneticZone className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.length === 0
              ? (
                  <div className="col-span-full py-32 flex flex-col items-center justify-center text-muted-foreground/50 border-2 border-dashed border-border/50 rounded-3xl bg-secondary/10">
                    <Icon icon="mingcute:ghost-line" className="w-16 h-16 mb-4 opacity-40" />
                    <p>{t("friends.empty")}</p>
                  </div>
                )
              : (
                  items.map(item => (
                    <MagneticHoverEffect
                      key={item._id}
                      as="a"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => !isMobile && setSelectedId(item._id)}
                      variant={selectedId === item._id && !isMobile ? "accent" : "default"}
                      className={cn(
                        "group relative flex items-start gap-3 p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden",
                        // Active state style improvement for dark mode:
                        // 使用渐变背景消除断层感
                        selectedId === item._id && !isMobile
                          ? "bg-linear-to-br from-secondary/50 to-secondary/30 backdrop-blur-sm border-primary/20 shadow-none ring-1 ring-primary/10"
                          : "bg-card/40 border-border/40 hover:bg-card/80 hover:border-border/80",
                      )}
                    >
                      <div className="relative shrink-0 mt-1">
                        <motion.img
                          layoutId={`avatar-${item._id}`}
                          src={item.avatar}
                          alt={item.name}
                          className="w-10 h-10 rounded-lg object-cover bg-secondary"
                          loading="lazy"
                        />
                        {item.health && (
                          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            {item.health.is_alive && (
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                            )}
                            <span
                              className={cn(
                                "relative inline-flex rounded-full h-2.5 w-2.5 border-2 border-card",
                                item.health.is_alive ? "bg-green-500" : "bg-red-500",
                              )}
                            />
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3
                          className={cn(
                            "font-semibold truncate text-sm transition-colors",
                            selectedId === item._id ? "text-primary" : "text-foreground",
                          )}
                        >
                          {item.name}
                        </h3>
                        <span className={cn(
                          "text-[10px] font-mono truncate block transition-colors mt-0.5",
                          selectedId === item._id ? "text-primary/80" : "text-foreground/50",
                        )}
                        >
                          {new URL(item.url).hostname}
                        </span>
                        <p className="mt-1.5 truncate text-xs leading-relaxed text-foreground/70">
                          {item.description || "暂无简介"}
                        </p>
                      </div>

                      {selectedId === item._id && !isMobile && (
                        <motion.div
                          layoutId="active-arrow"
                          className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-l-full"
                        />
                      )}
                    </MagneticHoverEffect>
                  ))
                )}
          </MagneticZone>
        </div>
      </div>
    </div>
  );
}
