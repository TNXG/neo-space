"use client";

import mermaid from "mermaid";
import { useEffect, useRef, useState } from "react";
import { ZoomableContainer } from "./ZoomableContainer";

interface MermaidDiagramProps {
	/** Mermaid 图表代码 */
	chart: string;
	/** 自定义 className */
	className?: string;
}

/**
 * Mermaid 图表渲染组件（客户端）
 * 支持缩放和拖拽功能
 */
export function MermaidDiagram({ chart, className = "" }: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [svg, setSvg] = useState<string>("");
	const [error, setError] = useState<string>("");

	useEffect(() => {
		// 初始化 Mermaid 配置
		mermaid.initialize({
			startOnLoad: false,
			theme: "default",
			securityLevel: "loose",
			// 使用与全站一致的字体栈
			fontFamily: "var(--font-noto-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'",
		});

		const renderDiagram = async () => {
			try {
				// 生成唯一 ID
				const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

				// 渲染图表
				const { svg: renderedSvg } = await mermaid.render(id, chart);
				setSvg(renderedSvg);
				setError("");
			} catch (err) {
				console.error("Mermaid rendering error:", err);
				setError(err instanceof Error ? err.message : "Failed to render diagram");
			}
		};

		renderDiagram();
	}, [chart]);

	if (error) {
		return (
			<div className="my-6 p-4 rounded-xl border border-red-200 bg-red-50/50 backdrop-blur-sm">
				<p className="text-sm font-medium text-red-800 mb-2">Mermaid 渲染错误</p>
				<pre className="text-xs text-red-600 overflow-x-auto">{error}</pre>
			</div>
		);
	}

	return (
		<ZoomableContainer className={`my-8 ${className}`}>
			<div
				ref={containerRef}
				className="flex justify-center items-center p-6 rounded-2xl bg-surface-100/50 backdrop-blur-sm border border-primary-200 shadow-sm"
				// 可信内容
				// eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
		</ZoomableContainer>
	);
}
