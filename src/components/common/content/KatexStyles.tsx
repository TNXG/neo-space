"use client";

import { useEffect } from "react";

import "katex/dist/katex.min.css";

/**
 * 客户端组件，用于按需加载 KaTeX 样式
 * 只在包含数学公式的页面渲染此组件
 * 包含移动端适配样式
 */
export function KatexStyles() {
	useEffect(() => {
		// 检查是否已经注入过样式
		if (document.getElementById("katex-mobile-styles")) {
			return;
		}

		const style = document.createElement("style");
		style.id = "katex-mobile-styles";
		style.textContent = `
			/* KaTeX 移动端适配 */
			
			/* 块级公式容器 - 支持横向滚动 */
			.katex-display {
				overflow-x: auto;
				overflow-y: hidden;
				-webkit-overflow-scrolling: touch;
				padding: 0.5rem 0;
				margin: 1rem 0;
			}
			
			/* 移动端块级公式滚动条样式 */
			.katex-display::-webkit-scrollbar {
				height: 4px;
			}
			
			.katex-display::-webkit-scrollbar-track {
				background: transparent;
			}
			
			.katex-display::-webkit-scrollbar-thumb {
				background: var(--primary-300);
				border-radius: 2px;
			}
			
			/* 块级公式内部确保不换行 */
			.katex-display > .katex {
				white-space: nowrap;
			}
			
			/* 行内公式基础样式 */
			.katex {
				font-size: 1.1em;
			}
			
			/* 移动端字体大小调整 */
			@media (max-width: 640px) {
				.katex {
					font-size: 1em;
				}
				
				.katex-display {
					margin: 0.75rem -1rem;
					padding: 0.5rem 1rem;
					border-radius: 0.5rem;
					background: var(--surface-100);
				}
				
				/* 移动端块级公式稍微缩小 */
				.katex-display > .katex {
					font-size: 0.95em;
				}
			}
			
			/* 超小屏幕进一步调整 */
			@media (max-width: 375px) {
				.katex {
					font-size: 0.9em;
				}
				
				.katex-display > .katex {
					font-size: 0.85em;
				}
			}
			
			/* 深色模式适配 */
			.dark .katex-display {
				background: var(--surface-200);
			}
		`;
		document.head.appendChild(style);

		return () => {
			// 组件卸载时不移除样式，因为可能有其他公式还在使用
		};
	}, []);

	return null;
}
