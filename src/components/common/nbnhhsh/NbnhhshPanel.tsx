"use client";

import { useEffect } from "react";
import { useNbnhhsh } from "./useNbnhhsh";

// 解析含义文本，分离主内容和括号内容
function parseTranslation(text: string): { main: string; note?: string } {
	// 查找最后一个括号对
	const openParen = text.lastIndexOf("(");
	const openParenCN = text.lastIndexOf("（");
	const parenIndex = Math.max(openParen, openParenCN);

	if (parenIndex > 0) {
		const closeParen = text.indexOf(")", parenIndex);
		const closeParenCN = text.indexOf("）", parenIndex);
		const closeIndex = closeParen > parenIndex ? closeParen : closeParenCN;

		if (closeIndex > parenIndex && closeIndex === text.length - 1) {
			return {
				main: text.slice(0, parenIndex).trim(),
				note: text.slice(parenIndex + 1, closeIndex).trim(),
			};
		}
	}
	return { main: text };
}

export function NbnhhshPanel() {
	const { results, isLoading, isOpen, close, position } = useNbnhhsh();

	// ESC 键关闭面板
	useEffect(() => {
		if (!isOpen)
			return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				close();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, close]);

	if (!isOpen)
		return null;

	return (
		<>
			{/* 点击外部关闭的遮罩层 */}
			<div
				className="fixed inset-0 z-40"
				onClick={close}
				aria-hidden="true"
			/>
			<div
				className={`z-50 w-72 max-h-[60vh] overflow-y-auto glass-card p-4 shadow-lg animate-fade-in ${
					position ? "absolute" : "fixed left-[calc(50%-380px)] top-1/2 -translate-y-1/2"
				}`}
				style={position ? { left: position.x, top: position.y } : undefined}
			>
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-sm font-medium text-primary-800">能不能好好说话</h3>
					<button
						type="button"
						onClick={close}
						className="text-primary-500 hover:text-primary-700 transition-colors text-lg leading-none cursor-pointer"
						aria-label="关闭"
					>
						×
					</button>
				</div>

				{isLoading
					? (
							<div className="flex items-center justify-center py-4">
								<div className="w-5 h-5 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
							</div>
						)
					: results.length === 0
						? (
								<p className="text-sm text-primary-500">暂无翻译结果</p>
							)
						: (
								<>
									<ul className="space-y-3">
										{results.map(item => (
											<li key={item.name} className="text-sm">
												<span className="font-mono text-accent-600 font-medium">{item.name}</span>
												{item.trans && item.trans.length > 0
													? (
															<div className="mt-1 space-y-1">
																{item.trans.map((t) => {
																	const { main, note } = parseTranslation(t);
																	return (
																		<span key={`${item.name}-${t}`} className="text-primary-700 relative inline-block mr-2">
																			{main}
																			{note && (
																				<sup className="ml-0.5 text-[10px] text-accent-500 bg-accent-100 px-1 rounded">
																					{note}
																				</sup>
																			)}
																		</span>
																	);
																})}
															</div>
														)
													: item.inputting && item.inputting.length > 0
														? (
																<p className="text-primary-500 mt-1 italic">
																	可能是：
																	{item.inputting.slice(0, 5).join("、")}
																</p>
															)
														: (
																<p className="text-primary-400 mt-1">未找到翻译</p>
															)}
											</li>
										))}
									</ul>
									<p className="mt-3 pt-2 border-t border-primary-200 text-xs text-primary-400">
										以上为 API 提供的可能含义
										<span className="mx-1">·</span>
										<a
											href="https://lab.magiconch.com/nbnhhsh/"
											target="_blank"
											rel="noopener noreferrer"
											className="text-accent-500 hover:text-accent-600 underline"
										>
											补充含义
										</a>
									</p>
								</>
							)}
			</div>
		</>
	);
}
