"use client";

import type { HostingProvider, Link } from "@/types/api";
import { Icon } from "@iconify/react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { MagneticHoverEffect, MagneticZone } from "@/components/common/magnetic-hover-effect";
import { useIsMobile } from "@/hook/use-is-mobile";
import { cn } from "@/lib/utils";

interface FriendsListProps {
  friends: Link[];
  collections: Link[];
}

// -----------------------------------------------------------------------------
// 常量定义
// -----------------------------------------------------------------------------

const HOSTING_PROVIDER_MAP: Record<HostingProvider, { icon: string; name: string }> = {
  vercel: { icon: "simple-icons:vercel", name: "Vercel" },
  cloudflare: { icon: "simple-icons:cloudflare", name: "Cloudflare" },
  netlify: { icon: "simple-icons:netlify", name: "Netlify" },
  github: { icon: "simple-icons:github", name: "GitHub Pages" },
  render: { icon: "simple-icons:render", name: "Render" },
  railway: { icon: "simple-icons:railway", name: "Railway" },
  fly: { icon: "simple-icons:fly", name: "Fly.io" },
  heroku: { icon: "simple-icons:heroku", name: "Heroku" },
  aws: { icon: "simple-icons:amazonaws", name: "AWS" },
  azure: { icon: "simple-icons:microsoftazure", name: "Azure" },
  gcp: { icon: "simple-icons:googlecloud", name: "Google Cloud" },
  aliyun: { icon: "simple-icons:alibabacloud", name: "阿里云" },
  tencent: { icon: "simple-icons:tencentqq", name: "腾讯云" },
  nginx: { icon: "simple-icons:nginx", name: "Nginx" },
  caddy: { icon: "simple-icons:caddy", name: "Caddy" },
  apache: { icon: "simple-icons:apache", name: "Apache" },
  unknown: { icon: "mingcute:question-line", name: "Unknown" },
};

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
// 子组件：Bento Card (通用卡片容器)
// -----------------------------------------------------------------------------

const BentoCard = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    transition={{ duration: 0.4, delay, ease: "easeOut" }}
    className={cn(
      "bg-card/50 backdrop-blur-md border border-border/40 rounded-2xl overflow-hidden p-4 flex flex-col justify-center",
      className,
    )}
  >
    {children}
  </motion.div>
);

// -----------------------------------------------------------------------------
// 主组件
// -----------------------------------------------------------------------------

export function FriendsList({ friends, collections }: FriendsListProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "collections">("friends");
  const isMobile = useIsMobile();

  const items = useMemo(
    () => (activeTab === "friends" ? friends : collections),
    [activeTab, friends, collections],
  );

  // 默认选中第一个
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 初始化选中状态 - 使用 useMemo 避免 useEffect 中的 setState
  const initialSelectedId = useMemo(() => {
    if (items.length > 0) {
      return items[0]._id;
    }
    return null;
  }, [items]);

  // 当 items 变化时同步更新 selectedId
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
  // 渲染预览面板 (Detail View - Left Side)
  // -------------------------------------------------------------------------
  const renderPreview = () => {
    if (!activeItem)
      return null;

    const { health } = activeItem;
    const providerInfo = health?.hosting_provider
      ? HOSTING_PROVIDER_MAP[health.hosting_provider]
      : HOSTING_PROVIDER_MAP.unknown;

    return (
      <motion.div
        key={activeItem._id}
        initial="initial"
        animate="animate"
        exit="exit"
        className="flex flex-col gap-3"
      >
        {/* 1. Header Card: Identity */}
        <BentoCard className="flex-row items-center gap-4 p-4 bg-linear-to-br from-card/80 to-secondary/20">
          <motion.div layoutId={`avatar-large-${activeItem._id}`} className="relative shrink-0">
            <img
              src={activeItem.avatar}
              alt={activeItem.name}
              className="w-16 h-16 rounded-xl object-cover shadow-lg ring-2 ring-background/50"
            />
            <div
              className={cn(
                "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center bg-background",
              )}
            >
              <div
                className={cn(
                  "w-full h-full rounded-full animate-pulse",
                  health?.is_alive ? "bg-green-500" : "bg-red-500",
                )}
              />
            </div>
          </motion.div>

          <div className="min-w-0 flex-1">
            <motion.h2
              layoutId={`title-${activeItem._id}`}
              className="text-xl font-bold truncate leading-tight tracking-tight"
            >
              {activeItem.name}
            </motion.h2>
            <a
              href={activeItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground/80 font-mono hover:text-accent-500 transition-colors flex items-center gap-1 mt-0.5 truncate group"
            >
              <span className="truncate">{activeItem.url}</span>
              <Icon
                icon="mingcute:external-link-line"
                className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0"
              />
            </a>
            {activeItem.created && (
              <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground/60">
                <Icon icon="mingcute:calendar-2-line" className="w-3 h-3" />
                <span>
                  加入于
                  {formatDate(activeItem.created)}
                </span>
              </div>
            )}
          </div>
        </BentoCard>

        {/* 2. Description Card */}
        <BentoCard delay={0.05} className="min-h-[60px] p-3 relative group">
          <Icon
            icon="mingcute:quote-left-fill"
            className="absolute top-3 left-3 text-primary/5 w-8 h-8 z-0 rotate-12 transition-transform group-hover:rotate-0"
          />
          <p className="text-xs leading-relaxed text-foreground/80 relative z-10">
            {activeItem.description || "这位朋友很神秘，没有留下介绍..."}
          </p>
        </BentoCard>

        {/* 3. Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Status Code & Health */}
          <BentoCard
            delay={0.1}
            className={cn(
              "gap-0.5 items-start p-3",
              health?.is_alive
                ? "bg-green-500/5 border-green-500/20"
                : "bg-red-500/5 border-red-500/20",
            )}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon
                icon="mingcute:heartbeat-line"
                className={cn("w-3.5 h-3.5", health?.is_alive ? "text-green-600" : "text-red-600")}
              />
              <span
                className={cn(
                  "text-[10px] font-bold uppercase",
                  health?.is_alive ? "text-green-700" : "text-red-700",
                )}
              >
                Status
              </span>
            </div>
            <div className="text-lg font-mono font-bold">
              {health?.status_code || (health?.is_alive ? "200" : "ERR")}
            </div>
            <div className="text-[10px] text-muted-foreground">HTTP Response</div>
          </BentoCard>

          {/* Latency */}
          <BentoCard delay={0.12} className="gap-0.5 items-start p-3">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Icon icon="mingcute:lightning-line" className="w-3.5 h-3.5 text-yellow-500" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Latency</span>
            </div>
            <div className={cn("text-lg font-mono font-bold", getLatencyColor(health?.latency_ms))}>
              {health?.latency_ms ? `${health.latency_ms}ms` : "-"}
            </div>
            <div className="text-[10px] text-muted-foreground">Response Time</div>
          </BentoCard>
        </div>

        {/* 4. Infrastructure & Tech */}
        <div className="grid grid-cols-3 gap-2">
          {/* Provider */}
          <BentoCard delay={0.15} className="col-span-1 items-center text-center p-2 gap-1">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-primary">
              <Icon icon={providerInfo.icon} className="w-4 h-4" />
            </div>
            <div className="text-[10px] font-medium truncate w-full" title={providerInfo.name}>
              {providerInfo.name}
            </div>
          </BentoCard>

          {/* Check Time */}
          <BentoCard
            delay={0.17}
            className="col-span-2 flex-row items-center justify-between gap-2 px-3 p-2"
          >
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Last Check
              </span>
              <span className="text-xs font-medium">
                {health?.checked_at ? formatTimeAgo(health.checked_at) : "未知"}
              </span>
            </div>
            <Icon icon="mingcute:history-line" className="w-4 h-4 text-muted-foreground/30" />
          </BentoCard>
        </div>

        {/* 5. Tech Stack Pills */}
        {activeItem.techstack && activeItem.techstack.length > 0 && (
          <BentoCard delay={0.2} className="gap-2 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <Icon icon="mingcute:code-line" className="w-3.5 h-3.5" />
              Technology
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeItem.techstack.map(tech => (
                <span
                  key={tech}
                  className="px-2 py-0.5 text-[10px] font-medium bg-secondary/80 text-secondary-foreground rounded border border-secondary"
                >
                  {tech}
                </span>
              ))}
            </div>
          </BentoCard>
        )}

        {/* 6. Contact & Links (RSS only) */}
        {activeItem.rssurl
          ? (
              <a
                href={activeItem.rssurl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-card/50 backdrop-blur-md border border-border/40 rounded-xl overflow-hidden p-3 flex flex-row items-center gap-2 hover:bg-orange-50/50 hover:border-orange-200 transition-colors cursor-pointer group"
              >
                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-lg">
                  <Icon icon="mingcute:rss-fill" className="w-3.5 h-3.5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-orange-700/80 group-hover:text-orange-700">
                    Subscribe
                  </span>
                  <span className="text-[9px] text-muted-foreground truncate">RSS Feed</span>
                </div>
              </a>
            )
          : (
              <BentoCard delay={0.22} className="opacity-50 grayscale flex-row items-center gap-2 p-3">
                <Icon icon="mingcute:rss-line" className="w-3.5 h-3.5" />
                <span className="text-[10px]">No RSS Feed Available</span>
              </BentoCard>
            )}

        {/* 7. Hint Text */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50 pt-2">
          <Icon icon="mingcute:cursor-3-line" className="w-3 h-3" />
          <span>点击右侧卡片访问站点</span>
        </div>
      </motion.div>
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
                {tab === "friends" ? "朋友" : "收藏"}
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
                <div className="overflow-y-auto no-scrollbar pr-1 max-h-[calc(100vh-8rem)]">{renderPreview()}</div>
              )
            : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground/40 bg-card/30 rounded-2xl border border-dashed border-border/50">
                  <Icon icon="mingcute:mouse-line" className="w-6 h-6 mb-2" />
                  <span className="text-sm">Hover a friend to view details</span>
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
                    <p>暂无数据</p>
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
                        selectedId === item._id && !isMobile
                          ? "bg-card border-primary/20 shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                          : "bg-card/40 border-border/40 hover:bg-card/80 hover:border-border/80",
                      )}
                    >
                      {/* Avatar */}
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

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5">
                          <h3
                            className={cn(
                              "font-semibold truncate text-sm transition-colors",
                              selectedId === item._id ? "text-foreground" : "text-foreground/90",
                            )}
                          >
                            {item.name}
                          </h3>
                          <span className="text-[10px] text-muted-foreground/60 font-mono truncate max-w-full">
                            {new URL(item.url).hostname}
                          </span>
                        </div>

                        {/* Description (Bio) instead of just URL */}
                        <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1 leading-relaxed">
                          {item.description || "暂无简介"}
                        </p>
                      </div>

                      {/* Active Indicator Arrow */}
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
