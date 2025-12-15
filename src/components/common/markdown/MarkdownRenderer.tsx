import type { Components } from "react-markdown";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { getHighlighter } from "./highlighter";
import { truncateText } from "./utils";

import "server-only";

/**
 * Markdown 渲染模式
 */
export type MarkdownRenderMode = "full" | "preview";

interface MarkdownRendererProps {
	/** Markdown 原始内容 */
	content: string;
	/** 渲染模式：full 完整渲染，preview 预览模式（省略图片和代码块） */
	mode?: MarkdownRenderMode;
	/** 预览模式下的最大字符数 */
	maxPreviewLength?: number;
	/** 自定义 className */
	className?: string;
}

/**
 * 完整模式的组件样式
 */
const fullComponents: Components = {
	h1: ({ children }) => (
		<h1 className="text-3xl font-bold text-primary-900 dark:text-primary-100 mt-8 mb-4">
			{children}
		</h1>
	),
	h2: ({ children }) => (
		<h2 className="text-2xl font-semibold text-primary-800 dark:text-primary-200 mt-6 mb-3">
			{children}
		</h2>
	),
	h3: ({ children }) => (
		<h3 className="text-xl font-medium text-primary-800 dark:text-primary-200 mt-4 mb-2">
			{children}
		</h3>
	),
	p: ({ children }) => (
		<p className="text-primary-700 dark:text-primary-300 leading-relaxed mb-4">
			{children}
		</p>
	),
	a: ({ href, children }) => (
		<a
			href={href}
			className="text-accent-600 dark:text-accent-400 hover:underline"
			target="_blank"
			rel="noopener noreferrer"
		>
			{children}
		</a>
	),
	ul: ({ children }) => (
		<ul className="list-disc list-inside text-primary-700 dark:text-primary-300 mb-4 space-y-1">
			{children}
		</ul>
	),
	ol: ({ children }) => (
		<ol className="list-decimal list-inside text-primary-700 dark:text-primary-300 mb-4 space-y-1">
			{children}
		</ol>
	),
	li: ({ children }) => <li className="leading-relaxed">{children}</li>,
	blockquote: ({ children }) => (
		<blockquote className="border-l-4 border-accent-400 pl-4 italic text-primary-600 dark:text-primary-400 my-4">
			{children}
		</blockquote>
	),
	code: ({ className, children }) => {
		const isInline = !className;
		if (isInline) {
			return (
				<code className="bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-sm text-primary-800 dark:text-primary-200">
					{children}
				</code>
			);
		}
		return <code className={className}>{children}</code>;
	},
	pre: ({ children }) => (
		<pre className="bg-neutral-900 rounded-lg p-4 overflow-x-auto mb-4">
			{children}
		</pre>
	),
	img: ({ src, alt }) => (
		<img
			src={src}
			alt={alt}
			className="rounded-lg max-w-full h-auto my-4"
		/>
	),
	table: ({ children }) => (
		<div className="overflow-x-auto mb-4">
			<table className="min-w-full border-collapse border border-neutral-300 dark:border-neutral-600">
				{children}
			</table>
		</div>
	),
	th: ({ children }) => (
		<th className="border border-neutral-300 dark:border-neutral-600 px-4 py-2 bg-neutral-100 dark:bg-neutral-800 text-left font-semibold">
			{children}
		</th>
	),
	td: ({ children }) => (
		<td className="border border-neutral-300 dark:border-neutral-600 px-4 py-2">
			{children}
		</td>
	),
	hr: () => <hr className="border-neutral-300 dark:border-neutral-600 my-6" />,
};

/**
 * 预览模式的组件样式（简化，图片和代码块用文字替代）
 */
const previewComponents: Components = {
	p: ({ children }) => <span className="text-primary-900">{children}</span>,
	h1: ({ children }) => <span className="text-primary-900">{children}</span>,
	h2: ({ children }) => <span className="text-primary-900">{children}</span>,
	h3: ({ children }) => <span className="text-primary-900">{children}</span>,
	a: ({ href, children, ...props }) => <a href={href} className="text-primary-900" {...props}>{children}</a>,
	ul: ({ children }) => <span className="text-primary-900">{children}</span>,
	ol: ({ children }) => <span className="text-primary-900">{children}</span>,
	li: ({ children }) => (
		<span className="text-primary-900">
			{children}
			{" "}
		</span>
	),
	blockquote: ({ children }) => <span className="text-primary-900">{children}</span>,
	img: () => <span className="text-neutral-400 dark:text-neutral-500 italic">[图片]</span>,
	pre: ({ children }) => {
		let lang = "";
		if (children && typeof children === "object" && "props" in children) {
			const codeProps = (children as any).props;
			const className = codeProps?.className || "";
			const match = /language-(\w+)/.exec(className);
			if (match)
				lang = match[1];
		}
		return (
			<span className="text-neutral-400 dark:text-neutral-500 italic">
				{lang ? `[${lang} 代码]` : "[代码块]"}
			</span>
		);
	},
	code: ({ children }) => (
		<code className="bg-neutral-200 dark:bg-neutral-700 px-1 rounded text-sm text-primary-900 dark:text-primary-100">
			{children}
		</code>
	),
	table: () => <span className="text-neutral-400 dark:text-neutral-500 italic">[表格]</span>,
	hr: () => null,
};

/**
 * SSR Markdown 渲染组件
 */
export async function MarkdownRenderer({
	content,
	mode = "full",
	maxPreviewLength = 150,
	className = "",
}: MarkdownRendererProps) {
	const isPreview = mode === "preview";
	const displayContent = isPreview ? truncateText(content, maxPreviewLength) : content;

	// 完整模式需要代码高亮
	const rehypePlugins: any[] = [rehypeRaw];
	if (!isPreview) {
		const highlighter = await getHighlighter();
		rehypePlugins.push([rehypeShikiFromHighlighter, highlighter, { theme: "github-dark-default" }]);
	}

	const baseClassName = isPreview
		? "text-primary-700 dark:text-primary-300"
		: "";

	return (
		<div className={`${baseClassName} ${className}`.trim()}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				rehypePlugins={rehypePlugins}
				components={isPreview ? previewComponents : fullComponents}
			>
				{displayContent}
			</ReactMarkdown>
		</div>
	);
}
