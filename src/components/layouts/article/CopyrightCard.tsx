"use client";

import { Icon } from "@iconify/react/offline";
import { useState } from "react";

function CCIcon(props: React.SVGProps<SVGSVGElement>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="24"
			height="24"
			viewBox="0 0 24 24"
			{...props}
		>
			<path
				fill="currentColor"
				d="M9 8c1.104 0 2.105.448 2.829 1.173l-1.414 1.413a2 2 0 1 0 0 2.828l1.413 1.414A4.001 4.001 0 0 1 5 12c0-2.208 1.792-4 4-4m9.829 1.173A4.001 4.001 0 0 0 12 12a4.001 4.001 0 0 0 6.828 2.828l-1.414-1.414a2 2 0 1 1 0-2.828zM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12m10-8a8 8 0 1 0 0 16a8 8 0 0 0 0-16"
			/>
		</svg>
	);
}

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

const ATOM_DATA: Record<LicenseAtom, { icon: string; label: string; desc: string }> = {
	CC: { icon: "custom-cc", label: "CC", desc: "知识共享许可" }, // 标记为 custom 使用您的 SVG
	BY: { icon: "mingcute:user-4-line", label: "BY", desc: "署名：必须保留原作者署名" },
	NC: { icon: "mingcute:currency-dollar-line", label: "NC", desc: "非商业：禁止用于商业目的" },
	ND: { icon: "mingcute:equal-line", label: "ND", desc: "禁止演绎：必须保持原样" },
	SA: { icon: "mingcute:refresh-2-line", label: "SA", desc: "相同方式共享：以同协议发布" },
	ZERO: { icon: "mingcute:hashtag-line", label: "CC0", desc: "公有领域：放弃所有权利" },
};

export interface CopyrightCardProps {
	licenseType?: keyof typeof LICENSES;
	author: string;
	year: string;
	postTitle?: string;
	className?: string;
}

export function CopyrightCard({
	licenseType = "BY-NC-SA",
	author,
	year,
	postTitle,
	className = "",
}: CopyrightCardProps) {
	const config = LICENSES[licenseType] || LICENSES["BY-NC-SA"];
	const [hoveredAtom, setHoveredAtom] = useState<LicenseAtom | null>(null);
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		const postLink = typeof window !== "undefined" ? window.location.href : "";
		const citation = postTitle
			? `${postTitle} - ${config.code} by ${author}. ${postLink}`
			: `${config.code} by ${author}. ${postLink}`;

		navigator.clipboard.writeText(citation).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	};

	return (
		<div className={`w-full max-w-3xl mx-auto my-8 ${className}`}>
			<div className="relative overflow-hidden rounded-xl border border-border bg-surface-100/80 backdrop-blur-md shadow-sm">
				<div className="absolute -bottom-6 -right-6 text-foreground/5 pointer-events-none select-none z-0">
					<CCIcon width={180} height={180} className="transform rotate-12" />
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
									{year}
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
                ${copied
			? "bg-accent-600 border-accent-600 text-white"
			: "bg-surface-100 border-primary-300 text-primary-600 hover:border-accent-400 hover:text-accent-700 dark:hover:border-accent-400"
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
                      ${isActive
										? "bg-accent-100 text-accent-700 scale-110 shadow-sm z-20"
										: "text-primary-400 hover:text-primary-700 dark:hover:text-primary-200"
									}
                    `}
									>
										{atom === "CC"
											? (
													<CCIcon width={20} height={20} />
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
						<div className="flex-1 min-h-[24px] flex items-center justify-center sm:justify-start relative">
							{/* 悬停时显示的图标描述 - 始终渲染所有可能的描述，通过 opacity 控制显示 */}
							{config.atoms.map(atom => (
								<div
									key={atom}
									className={`text-sm absolute inset-0 flex items-center justify-center sm:justify-start transition-opacity duration-200 ${
										hoveredAtom === atom ? "opacity-100" : "opacity-0 pointer-events-none"
									}`}
								>
									<div className="flex items-center gap-2">
										<span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent-100 text-accent-800 border border-accent-200 dark:border-accent-800/50">
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
