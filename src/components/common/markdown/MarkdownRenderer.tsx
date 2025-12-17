import type { Components } from "react-markdown";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { ClientOnlyScript } from "./components/ClientOnlyScript";
import { ClientOnlySpan } from "./components/ClientOnlySpan";
import { ImageFigure } from "./components/ImageFigure";
import { Spoiler } from "./components/Spoiler";
import { getHighlighter } from "./highlighter";
import { remarkSpoiler } from "./plugins/spoiler";

interface MarkdownRendererProps {
	/** Markdown 原始内容 */
	content: string;
	/** 自定义 className */
	className?: string;
	/** 是否包含需要客户端执行的脚本 */
	hasScript?: boolean;
} // 可选：用于外部链接图标

const components: Components = {
	h1: ({ children }) => (
		<h1 className="scroll-mt-24 text-3xl md:text-4xl font-extrabold tracking-tight text-primary-900 mt-10 mb-6 first:mt-0">
			{children}
		</h1>
	),
	h2: ({ children }) => (
		<h2 className="scroll-mt-24 text-2xl md:text-3xl font-bold tracking-tight text-primary-900 mt-12 mb-5 pb-2 border-b border-primary-200/50 dark:border-primary-800/50">
			{children}
		</h2>
	),
	h3: ({ children }) => (
		<h3 className="scroll-mt-24 text-xl md:text-2xl font-semibold text-primary-800 mt-8 mb-4">
			{children}
		</h3>
	),
	h4: ({ children }) => (
		<h4 className="scroll-mt-24 text-lg md:text-xl font-semibold text-primary-800 mt-6 mb-3">
			{children}
		</h4>
	),

	// 正文：行高 1.6 (leading-relaxed)，对比度 > 4.5:1
	p: ({ children }) => {
		// 检查是否只包含一个图片元素
		if (
			Array.isArray(children)
			&& children.length === 1
			&& typeof children[0] === "object"
			&& children[0]
			&& "type" in children[0]
			&& children[0].type === "img"
		) {
			// 如果段落只包含一个图片，使用 ImageFigure 组件
			const imgProps = children[0].props;
			return <ImageFigure src={imgProps.src} alt={imgProps.alt} />;
		}

		return (
			<p className="text-base md:text-lg leading-relaxed text-primary-700 mb-6 last:mb-0">
				{children}
			</p>
		);
	},

	// 链接：使用 Accent 色，悬停加深，强制 cursor-pointer
	a: ({ href, children }) => {
		const isInternal = href?.startsWith("/") || href?.startsWith("#");
		return (
			<a
				href={href}
				className="inline-flex items-center gap-0.5 font-medium text-accent-600 decoration-accent-300/50 underline-offset-4 hover:underline hover:text-accent-700 transition-colors cursor-pointer"
				target={isInternal ? "_self" : "_blank"}
				rel={isInternal ? undefined : "noopener noreferrer"}
			>
				{children}
				{/* 如果需要外部链接图标，可以在这里加 */}
			</a>
		);
	},

	// 列表：增加左侧 padding，调整 marker 颜色
	ul: ({ children }) => (
		<ul className="list-disc list-outside ml-6 mb-6 space-y-2 text-primary-700 marker:text-accent-500/70">
			{children}
		</ul>
	),
	ol: ({ children }) => (
		<ol className="list-decimal list-outside ml-6 mb-6 space-y-2 text-primary-700 marker:text-accent-500 font-medium">
			{children}
		</ol>
	),
	li: ({ children }) => (
		<li className="leading-relaxed pl-1">{children}</li>
	),

	// 引用块：应用 Glassmorphism 风格，左侧 Accent 强调线
	blockquote: ({ children }) => (
		<blockquote className="relative my-8 pl-6 py-4 pr-4 border-l-4 border-accent-500 rounded-r-2xl bg-surface-100/50 backdrop-blur-sm italic text-primary-600 shadow-sm">
			{children}
		</blockquote>
	),

	// 行内代码：Pill/Rounded 风格，轻微背景
	code: ({ className, children }) => {
		const isInline = !className;
		if (isInline) {
			return (
				<code className="px-1.5 py-0.5 mx-0.5 rounded-md text-sm font-mono bg-primary-100 text-accent-700 border border-primary-200/50 align-middle">
					{children}
				</code>
			);
		}
		// 块级代码的实际内容由 Shiki 处理，这里只处理容器
		return <code className={className}>{children}</code>;
	},

	// 代码块容器：大圆角，深色背景，内部滚动
	pre: ({ children, ...props }) => (
		<div className="relative my-8 group">
			<pre
				{...props}
				className="overflow-x-auto rounded-2xl border border-primary-200 bg-[#0d1117] p-5 text-sm leading-6 shadow-md scrollbar-thin scrollbar-thumb-primary-700 scrollbar-track-transparent"
			>
				{children}
			</pre>
		</div>
	),

	// 图片：大圆角，阴影，响应式
	img: ({ src, alt }) => (
		<img
			src={src}
			alt={alt}
			className="rounded-2xl border border-primary-200 shadow-md w-full h-auto max-h-[800px] object-cover bg-primary-50 my-4"
			loading="lazy"
		/>
	),

	// 表格：容器滚动，边框风格
	table: ({ children }) => (
		<div className="my-8 w-full overflow-x-auto rounded-xl border border-primary-200 shadow-sm">
			<table className="min-w-full divide-y divide-primary-200 text-left text-sm">
				{children}
			</table>
		</div>
	),
	thead: ({ children }) => (
		<thead className="bg-primary-50 font-semibold text-primary-900 dark:text-primary-100">
			{children}
		</thead>
	),
	tbody: ({ children }) => (
		<tbody className="divide-y divide-primary-200 bg-transparent">
			{children}
		</tbody>
	),
	tr: ({ children }) => (
		<tr className="transition-colors hover:bg-primary-50/50 dark:hover:bg-primary-800/30">
			{children}
		</tr>
	),
	th: ({ children }) => (
		<th className="px-4 py-3 text-left font-medium tracking-wider">
			{children}
		</th>
	),
	td: ({ children }) => (
		<td className="px-4 py-3 text-primary-700 align-top whitespace-normal leading-relaxed">
			{children}
		</td>
	),

	// 分割线：虚线，弱化视觉
	hr: () => (
		<hr className="my-12 border-dashed border-primary-200 w-1/2 mx-auto" />
	),

	// 自定义组件保持不变
	span: ({ className, children, ...props }) => {
		if (className === "spoiler") {
			return <Spoiler>{children}</Spoiler>;
		}
		if (props.id) {
			return <ClientOnlySpan {...props}>{children}</ClientOnlySpan>;
		}
		return <span {...props}>{children}</span>;
	},
	script: ({ children, ...props }) => {
		return <ClientOnlyScript {...props}>{children}</ClientOnlyScript>;
	},
};

/**
 * SSR Markdown 渲染组件
 */
export async function MarkdownRenderer({
	content,
	className = "",
}: MarkdownRendererProps) {
	const highlighter = await getHighlighter();
	const rehypePlugins: any[] = [
		rehypeRaw,
		rehypeSlug,
		[rehypeShikiFromHighlighter, highlighter, { theme: "github-dark-default" }],
	];

	return (
		<div className={className}>
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks, remarkSpoiler]}
				rehypePlugins={rehypePlugins}
				components={components}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}
