"use client";

import type { ComponentType, SVGProps } from "react";
import type { Comment } from "@/types/api";
import AndroidFill from "~icons/mingcute/android-fill";
import AppleFill from "~icons/mingcute/apple-fill";
import CheckCircleFill from "~icons/mingcute/check-circle-fill";
import ChromeFill from "~icons/mingcute/chrome-fill";
import ComputerLine from "~icons/mingcute/computer-line";
import Delete2Line from "~icons/mingcute/delete-2-line";
import EdgeFill from "~icons/mingcute/edge-fill";
import EyeCloseLine from "~icons/mingcute/eye-close-line";
import FirefoxFill from "~icons/mingcute/firefox-fill";
import GithubFill from "~icons/mingcute/github-fill";
import GlobeLine from "~icons/mingcute/globe-line";
import LinuxFill from "~icons/mingcute/linux-fill";
import LocationLine from "~icons/mingcute/location-line";
import PinFill from "~icons/mingcute/pin-fill";
import QqFill from "~icons/mingcute/qq-fill";
import SafariFill from "~icons/mingcute/safari-fill";
import TimeLine from "~icons/mingcute/time-line";
import UserSecurityFill from "~icons/mingcute/user-security-fill";
import WindowsFill from "~icons/mingcute/windows-fill";
import IeFill from "~icons/ri/ie-fill";
import OperaFill from "~icons/ri/opera-fill";

import { SmartDate } from "@/components/common/smart-date";
import { cn } from "@/lib/utils";
import { CommentState } from "@/types/api";

interface CommentHeaderProps {
  comment: Comment;
}

/**
 * 获取浏览器图标
 */
function getBrowserIcon(browser: string): ComponentType<SVGProps<SVGSVGElement>> {
  const name = browser.toLowerCase();
  if (name.includes("edge"))
    return EdgeFill;
  if (name.includes("firefox"))
    return FirefoxFill;
  if (name.includes("safari"))
    return SafariFill;
  if (name.includes("opera"))
    return OperaFill;
  if (name.includes("chrome") || name.includes("chromium"))
    return ChromeFill;
  if (name.includes("ie") || name.includes("internet explorer"))
    return IeFill;
  return GlobeLine;
}

/**
 * 获取操作系统图标
 */
function getOSIcon(os: string): ComponentType<SVGProps<SVGSVGElement>> {
  const name = os.toLowerCase();
  if (name.includes("windows"))
    return WindowsFill;
  if (name.includes("mac") || name.includes("ios"))
    return AppleFill;
  if (name.includes("android"))
    return AndroidFill;
  if (name.includes("linux"))
    return LinuxFill;
  return ComputerLine;
}

/**
 * 评论头部组件 - 显示头像、用户名、标签和时间
 */
export function CommentHeader({ comment }: CommentHeaderProps) {
  return (
    <div className="flex items-start sm:items-center gap-2 relative z-10">
      <img
        src={comment.avatar || `https://ui-avatars.com/api/?name=${comment.author}&background=random`}
        alt={comment.author}
        className={cn(
          "w-7 h-7 sm:w-9 sm:h-9 border rounded-full bg-background object-cover shrink-0",
          comment.isAdmin ? "border-green-500 ring-2 ring-green-500/20" : "border-border",
        )}
      />

      <dt className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <b className={cn("truncate max-w-[100px] sm:max-w-none", comment.isAdmin ? "text-green-700" : "text-foreground")}>
            {comment.author}
          </b>
          {comment.isAdmin && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-green-50 text-green-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="笔者">
              <CheckCircleFill className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">笔者</span>
            </span>
          )}
          <span className="text-[9px] sm:text-[10px] bg-muted text-muted-foreground px-1 rounded font-mono shrink-0">
            {comment.key}
          </span>
          {comment.pin && <PinFill className="text-red-500 w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />}

          {/* 待审核状态 */}
          {comment.state === CommentState.PENDING && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-yellow-50 text-yellow-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="评论正在审核中">
              <TimeLine className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">审核中</span>
            </span>
          )}
          {/* 垃圾评论状态 */}
          {comment.state === CommentState.SPAM && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-red-50 text-red-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="已被标记为垃圾评论">
              <Delete2Line className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">垃圾</span>
            </span>
          )}
          {/* 私密评论 */}
          {comment.isWhispers && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-orange-50 text-orange-700 px-1 sm:px-1.5 py-0.5 rounded font-medium shrink-0" title="仅作者和管理员可见">
              <EyeCloseLine className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              <span className="hidden sm:inline">私密</span>
            </span>
          )}

          {/* OAuth 来源标识 - 统一 Badge 风格 */}
          {comment.source === "from_oauth_github" && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-muted text-muted-foreground px-1 rounded font-medium shrink-0" title="GitHub 登录">
              <GithubFill className="w-3 h-3" />
              <span className="hidden sm:inline">GitHub</span>
            </span>
          )}
          {comment.source === "from_oauth_qq" && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-blue-50 text-blue-600 px-1 rounded font-medium shrink-0" title="QQ 登录">
              <QqFill className="w-3 h-3" />
              <span className="hidden sm:inline">QQ</span>
            </span>
          )}
          {comment.source === "from_oauth_both" && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] bg-violet-50 text-violet-600 px-1 rounded font-medium shrink-0" title="多平台绑定">
              <UserSecurityFill className="w-3 h-3" />
              <span className="hidden sm:inline">ALL</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <SmartDate date={comment.created} className="text-[10px] sm:text-xs text-muted-foreground" />

          {/* UA 信息显示 */}
          {comment.ua && comment.ua.os !== "unknown" && (() => {
            const OSIcon = getOSIcon(comment.ua.os);
            const BrowserIcon = getBrowserIcon(comment.ua.browser);
            return (
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] text-muted-foreground/70" title={`${comment.ua.os} ${comment.ua.osVersion} · ${comment.ua.browser} ${comment.ua.browserVersion}`}>
                <OSIcon className="w-3 h-3" />
                <span>
                  {comment.ua.os}
                  {" "}
                  {comment.ua.osVersion !== "unknown" && comment.ua.osVersion}
                </span>
                <BrowserIcon className="w-3 h-3" />
                <span>
                  {comment.ua.browser}
                  {" "}
                  {comment.ua.browserVersion !== "unknown" && comment.ua.browserVersion}
                </span>
              </span>
            );
          })()}

          {/* 地理位置信息 */}
          {comment.location && (
            <span className="flex items-center gap-0.5 text-[9px] sm:text-[10px] text-muted-foreground/70" title={`来自 ${comment.location}`}>
              <LocationLine className="w-3 h-3" />
              <span>{comment.location}</span>
            </span>
          )}
        </div>
      </dt>
    </div>
  );
}
