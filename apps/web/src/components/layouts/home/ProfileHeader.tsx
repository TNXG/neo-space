"use client";

import type { User } from "@/types/api";

import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { AbbreviationText } from "@/components/common/nbnhhsh";
import { SocialLink } from "@/components/ui/SocialLink";
import { useReaderWS } from "@/hooks/use-reader-ws";

interface ProfileHeaderProps {
  profile: User;
}

export function ProfileHeader({ profile }: ProfileHeaderProps) {
  const { isConnected, ownerStatus } = useReaderWS();

  // 通过 ws 中是否有 media 或 window 信息判断博主在线
  const isOwnerOnline = Boolean(
    isConnected
    && ownerStatus
    && (ownerStatus.mediaPlayback || ownerStatus.windowInfo || ownerStatus.netease?.active),
  );

  // 获取专辑封面
  const albumCover
    = ownerStatus?.mediaPlayback?.metadata?.artwork_url
      || ownerStatus?.netease?.song?.cover
      || null;

  // 获取歌曲信息
  const songName = ownerStatus?.mediaPlayback?.metadata?.title || ownerStatus?.netease?.song?.name || null;
  const artistName = ownerStatus?.mediaPlayback?.metadata?.artist || ownerStatus?.netease?.song?.artist || null;

  return (
    <header className="space-y-4 md:space-y-8">
      {/* 桌面端：头像在左，信息在右，高度对齐 */}
      <div className="hidden md:flex">
        {/* 左侧：头像 */}
        <div className="shrink-0">
          <div className="relative">
            <div className="rounded-2xl bg-secondary w-40 h-full min-h-[140px] shadow-sm relative overflow-hidden border border-border/50">
              {profile.avatar
                ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback)
                          fallback.classList.remove("hidden");
                      }}
                    />
                  )
                : null}
              <div className={`text-4xl font-bold h-full w-full items-center justify-center from-secondary to-secondary-foreground bg-linear-to-br text-muted-foreground ${profile.avatar ? "hidden" : "flex"}`}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
            </div>
            {/* 在线状态指示器 */}
            <div className="rounded-full flex h-4 w-4 items-center bottom-2 right-2 justify-center absolute bg-background border border-border">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOwnerOnline ? "animate-ping bg-accent-500" : "hidden"}`} />
                <span className={`relative inline-flex rounded-full h-full w-full transition-colors duration-300 ${isOwnerOnline ? "bg-accent-500" : "bg-neutral-400"}`} />
              </span>
            </div>
          </div>
        </div>

        {/* 右侧：信息区域 */}
        <div className="flex-1 min-w-0 pl-6 py-1">
          {/* 名字和用户名在同一行 */}
          <h1 className="text-2xl lg:text-3xl tracking-tight font-bold text-foreground">
            {profile.name}
            <span className="text-muted-foreground font-normal ml-1">
              @
              {profile.username}
            </span>
          </h1>

          {/* 简介 */}
          <p className="text-base lg:text-lg leading-relaxed text-secondary-foreground mt-2">
            <AbbreviationText>{profile.introduce}</AbbreviationText>
          </p>

          {/* 社交链接 */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            <SocialLinks profile={profile} />
          </div>

          {/* 专辑封面 - 代替 OwnerStatus 的"正在听" */}
          <AlbumCover cover={albumCover} songName={songName} artistName={artistName} />
        </div>
      </div>

      {/* 移动端：紧凑布局 */}
      <div className="flex md:hidden flex-col gap-3">
        <div className="flex gap-3 items-center">
          <div className="relative shrink-0">
            <div className="rounded-2xl bg-secondary h-14 w-14 shadow-sm relative overflow-hidden">
              {profile.avatar
                ? (
                    <img
                      src={profile.avatar}
                      alt={profile.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const fallback = target.nextElementSibling as HTMLElement;
                        if (fallback)
                          fallback.classList.remove("hidden");
                      }}
                    />
                  )
                : null}
              <div className={`text-xl font-bold h-full w-full items-center justify-center from-secondary to-secondary-foreground bg-linear-to-br text-muted-foreground ${profile.avatar ? "hidden" : "flex"}`}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
            </div>
            {/* 在线状态指示器 */}
            <div className="rounded-full flex h-3 w-3 items-center bottom-0 right-0 justify-center absolute bg-background border border-border">
              <span className="relative flex h-2 w-2">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${isOwnerOnline ? "animate-ping bg-accent-500" : "hidden"}`} />
                <span className={`relative inline-flex rounded-full h-full w-full transition-colors duration-300 ${isOwnerOnline ? "bg-accent-500" : "bg-neutral-400"}`} />
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <h1 className="text-xl tracking-tight font-bold mb-0.5 text-foreground">
              {profile.name}
              <span className="text-muted-foreground font-normal ml-1">
                @
                {profile.username}
              </span>
            </h1>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-secondary-foreground">
          <AbbreviationText>{profile.introduce}</AbbreviationText>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <SocialLinks profile={profile} />
          <AlbumCover cover={albumCover} songName={songName} artistName={artistName} />
        </div>
      </div>
    </header>
  );
}

function AlbumCover({ cover, songName, artistName }: {
  cover: string | null;
  songName?: string | null;
  artistName?: string | null;
}) {
  const t = useTranslations();

  // 没有歌曲信息时不显示
  if (!songName || !cover)
    return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={songName || cover}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="flex items-center gap-3 mt-2"
      >
        <div className="h-10 w-10 rounded-lg overflow-hidden shadow-sm border border-border/50 flex-shrink-0">
          <img
            src={cover}
            alt={t("home.album.playingAlt")}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = "none";
            }}
          />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {artistName
              ? t("home.status.listeningWithArtist", { title: songName, artist: artistName })
              : t("home.status.listening", { title: songName })}
          </span>
          {artistName && (
            <span className="text-xs text-muted-foreground">
              {artistName}
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function SocialLinks({ profile }: { profile: User }) {
  return (
    <>
      {profile.socialIds?.github && (
        <SocialLink
          icon="mingcute:github-line"
          href={`https://github.com/${profile.socialIds.github}`}
          label="GitHub"
        />
      )}
      {profile.socialIds?.twitter && (
        <SocialLink
          icon="mingcute:twitter-line"
          href={`https://twitter.com/${profile.socialIds.twitter}`}
          label="Twitter"
        />
      )}
      {profile.mail && (
        <SocialLink
          icon="mingcute:mail-line"
          href={`mailto:${profile.mail}`}
          label="Email"
        />
      )}
      {profile.socialIds?.bilibili && (
        <SocialLink
          icon="mingcute:tv-2-line"
          href={`https://space.bilibili.com/${profile.socialIds.bilibili}`}
          label="Bilibili"
        />
      )}
      {profile.socialIds?.netease && (
        <SocialLink
          icon="mingcute:music-line"
          href={`https://music.163.com/#/user/home?id=${profile.socialIds.netease}`}
          label="NetEase Music"
        />
      )}
      {profile.socialIds?.telegram && (
        <SocialLink
          icon="mingcute:telegram-line"
          href={`https://t.me/${profile.socialIds.telegram}`}
          label="Telegram"
        />
      )}
      {profile.url && (
        <SocialLink
          icon="mingcute:world-line"
          href={profile.url}
          label="Website"
        />
      )}
      {profile.socialIds?.rss && (
        <SocialLink
          icon="mingcute:rss-line"
          href={profile.socialIds.rss}
          label="RSS"
        />
      )}
    </>
  );
}
