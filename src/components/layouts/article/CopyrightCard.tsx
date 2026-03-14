"use client";

import { useEffect, useRef, useState } from "react";
import { CreativeCommonsIcon } from "@/lib/file-icons";
import { Icon } from "@/lib/inline-icon";

type LicenseAtom = "CC" | "BY" | "NC" | "ND" | "SA" | "ZERO";

interface LicenseConfig {
  code: string;
  name: string;
  atoms: LicenseAtom[];
  url: string;
}

const LICENSES: Record<string, LicenseConfig> = {
  "BY-NC-SA": {
    code: "CC BY-NC-SA 4.0",
    name: "署名-非商业性使用-相同方式共享",
    atoms: ["CC", "BY", "NC", "SA"],
    url: "https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh",
  },
  "BY-NC-ND": {
    code: "CC BY-NC-ND 4.0",
    name: "署名-非商业性使用-禁止演绎",
    atoms: ["CC", "BY", "NC", "ND"],
    url: "https://creativecommons.org/licenses/by-nc-nd/4.0/deed.zh",
  },
  "BY": {
    code: "CC BY 4.0",
    name: "署名",
    atoms: ["CC", "BY"],
    url: "https://creativecommons.org/licenses/by/4.0/deed.zh",
  },
  "CC0": {
    code: "CC0 1.0",
    name: "公共领域贡献宣告",
    atoms: ["ZERO"],
    url: "https://creativecommons.org/publicdomain/zero/1.0/deed.zh",
  },
};

const ATOM_DATA: Record<
  LicenseAtom,
  { icon: string; label: string; desc: string }
> = {
  CC: {
    icon: "simple-icons:creativecommons",
    label: "CC",
    desc: "知识共享许可",
  },
  BY: {
    icon: "mingcute:user-4-line",
    label: "BY",
    desc: "署名：必须保留原作者署名",
  },
  NC: {
    icon: "mingcute:currency-dollar-line",
    label: "NC",
    desc: "非商业：禁止用于商业目的",
  },
  ND: {
    icon: "mingcute:balance-line",
    label: "ND",
    desc: "禁止演绎：必须保持原样",
  },
  SA: {
    icon: "mingcute:refresh-2-line",
    label: "SA",
    desc: "相同方式共享：以同协议发布",
  },
  ZERO: {
    icon: "mingcute:hashtag-line",
    label: "CC0",
    desc: "公有领域：放弃所有权利",
  },
};

interface CopyrightCardPropsBase {
  licenseType?: keyof typeof LICENSES;
  author: string;
  postTitle?: string;
  className?: string;
}

interface CopyrightCardSingleYearProps {
  year: string;
  createdYear?: never;
  modifiedYear?: never;
}

interface CopyrightCardRangeYearProps {
  year?: never;
  createdYear: string;
  modifiedYear?: string;
}

export type CopyrightCardProps = CopyrightCardPropsBase
  & (CopyrightCardSingleYearProps | CopyrightCardRangeYearProps);

export function CopyrightCard({
  licenseType = "BY-NC-SA",
  author,
  year,
  createdYear,
  modifiedYear,
  postTitle,
  className = "",
}: CopyrightCardProps) {
  const config = LICENSES[licenseType] || LICENSES["BY-NC-SA"];
  const [hoveredAtom, setHoveredAtom] = useState<LicenseAtom | null>(null);
  const [displayedAtom, setDisplayedAtom] = useState<LicenseAtom | null>(null);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 防抖：hoveredAtom 变化后延迟更新 displayedAtom
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (hoveredAtom === null) {
      // 立即隐藏，使用 setTimeout(0) 避免同步更新
      timeoutRef.current = setTimeout(() => {
        setDisplayedAtom(null);
      }, 0);
    } else {
      // 延迟显示，等待 a 标签淡出
      timeoutRef.current = setTimeout(() => {
        setDisplayedAtom(hoveredAtom);
      }, 150);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hoveredAtom]);

  const startYear = createdYear ?? year ?? "";
  const endYear = modifiedYear ?? createdYear ?? year ?? "";
  const displayYear
    = startYear && endYear && startYear !== endYear
      ? `${startYear} - ${endYear}`
      : startYear || endYear;

  const handleCopy = () => {
    const postLink = typeof window !== "undefined" ? window.location.href : "";
    const citation = postTitle
      ? `${postTitle} - ${config.code} by ${author}. ${postLink}`
      : `${config.code} by ${author}. ${postLink}`;

    navigator.clipboard.writeText(citation).then(() => {
      setCopied(true);
      setTimeout(setCopied, 2000, false);
    });
  };

  return (
    <div className={`w-full max-w-3xl mx-auto my-8 ${className}`}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-100/80 backdrop-blur-md shadow-sm">
        <div className="absolute -bottom-6 -right-6 text-foreground/5 pointer-events-none select-none z-0">
          <CreativeCommonsIcon size={180} className="transform rotate-12" />
        </div>
        <div className="relative z-10 p-6 flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-primary-500 uppercase">
                <span> Copyright & License</span>
              </div>

              <div className="flex flex-col">
                <div className="text-lg md:text-xl font-bold text-foreground">
                  ©
                  {" "}
                  {displayYear}
                  {" "}
                  {author}
                </div>
                {postTitle && (
                  <div className="text-sm text-primary-500 line-clamp-1 mt-0.5">
                    {postTitle}
                  </div>
                )}
              </div>
            </div>

            {/* 复制按钮 */}
            <button
              type="button"
              onClick={handleCopy}
              className={`
                shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer
                ${
    copied
      ? "bg-accent-600 border-accent-600 text-white"
      : "bg-surface-100 border-primary-300 text-primary-600 hover:border-accent-400 hover:text-accent-700"
    }
              `}
            >
              <Icon
                icon={copied ? "mingcute:check-line" : "mingcute:copy-2-line"}
                className="text-base"
              />
              <span>{copied ? "已复制" : "复制引用"}</span>
            </button>
          </div>

          <div className="h-px w-full bg-border/60" />

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div
              className="flex items-center gap-2 bg-surface-200/50 p-2 rounded-xl border border-border/50"
              onMouseLeave={() => setHoveredAtom(null)}
            >
              {config.atoms.map((atom) => {
                const isActive = hoveredAtom === atom;
                const data = ATOM_DATA[atom];
                return (
                  <div
                    key={atom}
                    onMouseEnter={() => setHoveredAtom(atom)}
                    className={`
                      relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 cursor-help
                      ${
                  isActive
                    ? "bg-accent-100 text-accent-700 scale-110 shadow-sm z-20"
                    : "text-primary-400 hover:text-primary-700"
                  }
                    `}
                  >
                    {atom === "CC"
                      ? (
                          <CreativeCommonsIcon size={20} />
                        )
                      : (
                          <Icon icon={data.icon} width={20} height={20} />
                        )}

                    {isActive && (
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent-500" />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex-1 min-h-6 flex items-center justify-center sm:justify-start relative">
              {/* 悬停时显示的图标描述 - 始终渲染所有可能的描述，通过 opacity 控制显示 */}
              {config.atoms.map(atom => (
                <div
                  key={atom}
                  className={`text-sm absolute inset-0 flex items-center justify-center sm:justify-start transition-opacity duration-200 ${
                    displayedAtom === atom
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent-100 text-accent-800 border border-accent-200">
                      {ATOM_DATA[atom].label}
                    </span>
                    <span className="text-primary-600 font-medium">
                      {ATOM_DATA[atom].desc}
                    </span>
                  </div>
                </div>
              ))}
              {/* 默认显示的许可协议链接 */}
              <a
                href={config.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-1 text-primary-500 hover:text-accent-600 transition-opacity duration-200 group ${
                  hoveredAtom ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              >
                <Icon icon="mingcute:information-line" className="text-base" />
                <span>许可协议：</span>
                <span className="font-semibold underline decoration-dashed decoration-primary-300 underline-offset-4 group-hover:decoration-accent-400">
                  {config.name}
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
