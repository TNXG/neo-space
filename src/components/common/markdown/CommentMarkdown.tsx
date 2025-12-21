"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { Spoiler } from "./components/Spoiler";
import { remarkSpoiler } from "./plugins/spoiler";

/**
 * 检查是否为 owo 表情包链接
 * owo 表情包通常来自特定的 CDN 域名
 */
const isOwoEmoji = (src: string | undefined): boolean => {
	if (!src)
		return false;
	// 匹配常见的 owo 表情包 CDN 域名
	const owoPatterns = [
		/cdn\.tnxg\.top\/images\/face/i,
		/owo\.json/i,
		/emotion/i,
		/emoji/i,
		/face/i,
	];
	return owoPatterns.some(pattern => pattern.test(src));
};

/**
 * 评论专用 Markdown 组件样式
 * 基于 MarkdownRenderer 样式，带安全处理
 */
const commentComponents: Components = {
	p: ({ children }) => (
		<p className="text-[15px] leading-relaxed text-primary-700 mb-3 last:mb-0 wrap-break-word">
			{children}
		</p>
	),

	a: ({ href, children }) => (
		<a
			href={href}
			className="inline-flex flex-wrap items-center gap-0.5 font-medium text-accent-600 decoration-accent-300/50 underline-offset-4 hover:underline hover:text-accent-700 transition-colors cursor-pointer wrap-anywhere"
			target="_blank"
			rel="noopener noreferrer"
		>
			{children}
		</a>
	),

	strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
	em: ({ children }) => <em>{children}</em>,
	del: ({ children }) => <del className="line-through text-primary-500">{children}</del>,

	code: ({ className, children }) => {
		const isInline = !className;
		if (isInline) {
			return (
				<code className="px-1.5 py-0.5 mx-0.5 rounded-md text-[0.9em] font-mono align-middle bg-primary-200/40 border border-primary-200/60 text-accent-700 break-all">
					{children}
				</code>
			);
		}
		return <code className={className}>{children}</code>;
	},

	pre: ({ children }) => (
		<pre className="my-3 p-3 rounded-xl bg-surface-100/50 border border-primary-200/50 overflow-x-auto text-sm font-mono">
			{children}
		</pre>
	),

	ul: ({ children }) => (
		<ul className="list-disc list-outside ml-5 mb-3 space-y-1 text-primary-700 marker:text-accent-500/70">
			{children}
		</ul>
	),

	ol: ({ children }) => (
		<ol className="list-decimal list-outside ml-5 mb-3 space-y-1 text-primary-700 marker:text-accent-500 font-medium">
			{children}
		</ol>
	),

	li: ({ children }) => <li className="leading-relaxed pl-1 wrap-break-word">{children}</li>,

	blockquote: ({ children }) => (
		<blockquote className="relative my-3 pl-4 py-2 pr-3 border-l-4 border-accent-500 rounded-r-xl bg-surface-100/50 italic text-primary-600 wrap-break-word">
			{children}
		</blockquote>
	),

	img: ({ src, alt }) => {
		// 类型守卫：确保 src 是字符串
		const srcString = typeof src === "string" ? src : undefined;
		const isEmoji = isOwoEmoji(srcString);

		if (isEmoji) {
			// owo 表情包：小图内联显示
			return (
				<img
					src={srcString}
					alt={alt || "emoji"}
					className="inline-block w-12 h-12 mx-0.5 align-middle object-contain"
					loading="lazy"
					title={alt || ""}
				/>
			);
		}

		// 普通图片：正常大小显示
		return (
			<img
				src={srcString}
				alt={alt || ""}
				className="max-w-full h-auto rounded-lg my-2"
				loading="lazy"
			/>
		);
	},

	// 评论中标题降级为加粗文本
	h1: ({ children }) => <p className="font-bold text-primary-800 mb-2">{children}</p>,
	h2: ({ children }) => <p className="font-bold text-primary-800 mb-2">{children}</p>,
	h3: ({ children }) => <p className="font-semibold text-primary-800 mb-2">{children}</p>,

	// 简化表格显示
	table: ({ children }) => (
		<div className="my-3 w-full overflow-x-auto rounded-lg border border-primary-200">
			<table className="min-w-full divide-y divide-primary-200 text-left text-sm">{children}</table>
		</div>
	),
	thead: ({ children }) => <thead className="bg-primary-50 font-semibold">{children}</thead>,
	tbody: ({ children }) => <tbody className="divide-y divide-primary-200">{children}</tbody>,
	tr: ({ children }) => <tr>{children}</tr>,
	th: ({ children }) => <th className="px-3 py-2 text-left font-medium">{children}</th>,
	td: ({ children }) => <td className="px-3 py-2">{children}</td>,

	hr: () => <hr className="my-4 border-dashed border-primary-200 w-1/2 mx-auto" />,

	span: ({ className, children, ...props }) => {
		const { node: _node, ...rest } = props as any;

		if (className === "spoiler") {
			return <Spoiler>{children}</Spoiler>;
		}

		const { id: _id, ...restWithoutId } = rest;

		return (
			<span className={className} {...restWithoutId}>
				{children}
			</span>
		);
	},
};

interface CommentMarkdownProps {
	content: string;
	className?: string;
}

/**
 * 评论专用 Markdown 渲染器
 * 使用 rehype-sanitize 进行 XSS 防护
 */
export function CommentMarkdown({ content, className = "" }: CommentMarkdownProps) {
	return (
		<div className={`comment-markdown ${className}`}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks, remarkSpoiler]}
				rehypePlugins={[rehypeSanitize]}
				components={commentComponents}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
