"use client";

import { useId } from "react";

/** 原创矢量星海场景；减少动态效果时仅呈现静态构图。 */
export function ObservatoryScene() {
  const id = useId().replaceAll(":", "");

  return (
    <section className="observatory-scene relative flex min-w-0 flex-col justify-end" aria-labelledby="observatory-heading">
      <div className="observatory-art pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 760 650" fill="none" className="size-full overflow-visible">
          <defs>
            <radialGradient id={`${id}-planet`} cx="0.28" cy="0.2" r="0.85">
              <stop stopColor="var(--observatory-ice)" />
              <stop offset="0.28" stopColor="var(--observatory-blue)" />
              <stop offset="0.66" stopColor="var(--observatory-violet)" />
              <stop offset="1" stopColor="var(--observatory-space)" />
            </radialGradient>
            <linearGradient id={`${id}-ring`} x1="100" y1="100" x2="650" y2="450" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--observatory-ice)" stopOpacity="0.1" />
              <stop offset="0.45" stopColor="var(--observatory-ice)" />
              <stop offset="0.72" stopColor="var(--observatory-lilac)" />
              <stop offset="1" stopColor="var(--observatory-lilac)" stopOpacity="0" />
            </linearGradient>
            <radialGradient id={`${id}-halo`}>
              <stop stopColor="var(--observatory-blue)" stopOpacity="0.4" />
              <stop offset="1" stopColor="var(--observatory-blue)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`${id}-horizon`} x2="1" y2="0">
              <stop stopColor="var(--observatory-ice)" stopOpacity="0" />
              <stop offset="0.48" stopColor="var(--observatory-ice)" stopOpacity="0.7" />
              <stop offset="1" stopColor="var(--observatory-lilac)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle cx="375" cy="280" r="295" fill={`url(#${id}-halo)`} />
          <g stroke="var(--observatory-ice)" strokeOpacity="0.2">
            <circle cx="375" cy="280" r="234" strokeDasharray="2 12" />
            <path d="M375 18v30m0 464v30M113 280h30m464 0h30" />
            <path d="M130 105h36v-30M584 468v-30h36" />
            <ellipse cx="375" cy="280" rx="330" ry="105" transform="rotate(-28 375 280)" />
          </g>
          <g className="observatory-orbit">
            <circle cx="375" cy="46" r="5" fill="var(--observatory-ice)" />
            <circle cx="375" cy="46" r="12" stroke="var(--observatory-ice)" strokeOpacity="0.35" />
            <circle cx="375" cy="514" r="3" fill="var(--observatory-lilac)" />
          </g>
          <g className="observatory-planet">
            <circle cx="375" cy="280" r="160" fill={`url(#${id}-planet)`} stroke="var(--observatory-ice)" strokeOpacity="0.55" />
            <path d="M230 214c62-88 185-100 253-17M221 250c77-87 197-68 271-19M220 291c68-66 209-62 302-5" stroke="var(--observatory-ice)" strokeOpacity="0.12" strokeWidth="2" />
            <path d="M251 185a160 160 0 0 1 228-25" stroke="var(--observatory-ice)" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="375" cy="280" rx="270" ry="67" transform="rotate(-28 375 280)" stroke={`url(#${id}-ring)`} strokeWidth="15" strokeOpacity="0.12" />
            <path d="M136 407c20 38 143 5 275-65s224-149 204-187" stroke={`url(#${id}-ring)`} strokeWidth="3" />
            <path d="M127 414c22 42 154 7 293-67s235-159 214-201" stroke={`url(#${id}-ring)`} strokeWidth="1" />
          </g>
          <circle cx="583" cy="105" r="23" fill={`url(#${id}-planet)`} stroke="var(--observatory-lilac)" strokeOpacity="0.5" />
          <g fill="var(--observatory-ice)">
            <path d="m153 148 2 9 9 2-9 2-2 9-2-9-9-2 9-2zM570 370l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" />
            <circle cx="190" cy="374" r="2" /><circle cx="517" cy="72" r="2" /><circle cx="660" cy="254" r="1.5" />
          </g>
          <g stroke="var(--observatory-ice)" strokeOpacity="0.25">
            <path d="m118 336 12-23 9 28-12 12zM558 450l16-30 8 39-17 12z" fill="var(--observatory-blue)" fillOpacity="0.15" />
            <path d="M54 551q326-95 652 0M30 570q350-95 700 0M0 594q380-95 760 0M-30 625q410-95 820 0" />
            <path d="m375 510-300 140m300-140L215 650m160-140v140m0-140 160 140M375 510l300 140" />
          </g>
          <path d="M0 527q375-80 760 0" stroke={`url(#${id}-horizon)`} strokeWidth="2" />
        </svg>
        <span className="observatory-coordinate absolute left-[8%] top-[34%] font-mono text-[0.625rem] tracking-[0.2em]">NEO / CELESTIAL ARCHIVE</span>
      </div>
      <div className="relative z-10 flex flex-col items-start gap-5 lg:pb-6">
        <p className="flex items-center gap-3 font-mono text-xs tracking-[0.3em] text-primary"><span className="h-px w-8 bg-primary" /> BEYOND THE ORDINARY</p>
        <h1 id="observatory-heading" className="text-3xl leading-[1.3] font-medium tracking-tight lg:text-5xl xl:text-6xl">每一个世界，<br /><span className="observatory-title">都从这里开始。</span></h1>
        <p className="hidden max-w-sm text-sm leading-7 text-muted-foreground lg:block">收藏灵感，记录日常。<br />欢迎回到你的私人宇宙。</p>
      </div>
    </section>
  );
}
