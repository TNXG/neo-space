import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { AbbreviationText } from "@/components/common/nbnhhsh";

import { AnimatedLink } from "../content/AnimatedLink";

import { ClientOnlyScript } from "../content/ClientOnlyScript";
import { CodeBlock } from "../content/CodeBlock";
import { ContainerBlock } from "../content/ContainerBlock";
import { EnhancedHeading } from "../content/EnhancedHeading";
import { ImageFigure } from "../content/ImageFigure";
import { KatexStyles } from "../content/KatexStyles";
import { MermaidDiagram } from "../content/MermaidDiagram";

import { Spoiler } from "../content/Spoiler";
import { getHighlighter } from "./highlighter";

import { remarkContainer } from "./plugins/container";
import { remarkMathDelimiters } from "./plugins/math";
import { remarkMermaid } from "./plugins/mermaid";
import { remarkSpoiler } from "./plugins/spoiler";

import { getStandaloneImageProps } from "./utils";

interface MarkdownRendererProps {
	content: string;
	className?: string;
	hasScript?: boolean;
}

// 辅助函数：检测是否为纯文本内容
const isTextOnlyContent = (node: ReactNode): boolean => {
	if (node === null || node === undefined || typeof node === "boolean")
		return true;
	if (typeof node === "string" || typeof node === "number")
		return true;
	if (Array.isArray(node))
		return node.every(child => isTextOnlyContent(child));
	return true;
};

const components: Components = {
	h1: ({ children, id }) => (
		<EnhancedHeading
			id={id}
			level={1}
			className="scroll-mt-20 md:scroll-mt-24 text-2xl md:text-4xl font-extrabold tracking-tight text-primary-900 mt-8 md:mt-10 mb-5 md:mb-6 first:mt-0 wrap-break-word"
		>
			{children}
		</EnhancedHeading>
	),
	h2: ({ children, id }) => (
		<EnhancedHeading
			id={id}
			level={2}
			className="scroll-mt-20 md:scroll-mt-24 text-xl md:text-3xl font-bold tracking-tight text-primary-900 mt-10 md:mt-12 mb-4 md:mb-5 pb-2 border-b border-primary-200/50 wrap-break-word"
		>
			{children}
		</EnhancedHeading>
	),
	h3: ({ children, id }) => (
		<EnhancedHeading
			id={id}
			level={3}
			className="scroll-mt-20 md:scroll-mt-24 text-lg md:text-2xl font-semibold text-primary-800 mt-6 md:mt-8 mb-3 md:mb-4 wrap-break-word"
		>
			{children}
		</EnhancedHeading>
	),
	h4: ({ children, id }) => (
		<EnhancedHeading
			id={id}
			level={4}
			className="scroll-mt-20 md:scroll-mt-24 text-base md:text-xl font-semibold text-primary-800 mt-5 md:mt-6 mb-2.5 md:mb-3 wrap-break-word"
		>
			{children}
		</EnhancedHeading>
	),

	a: ({ href, children }) => {
		const isInternal = href?.startsWith("/") || href?.startsWith("#");
		return (
			<AnimatedLink
				href={href || "#"}
				className="inline-flex flex-wrap items-center gap-0.5 font-medium text-accent-600 hover:text-accent-700 transition-colors cursor-pointer wrap-anywhere"
				target={isInternal ? "_self" : "_blank"}
				rel={isInternal ? undefined : "noopener noreferrer"}
			>
				{children}
			</AnimatedLink>
		);
	},

	ul: ({ children }) => (
		<ul className="list-disc list-outside ml-5 md:ml-6 mb-5 md:mb-6 space-y-1.5 md:space-y-2 text-primary-700 marker:text-accent-500/70">
			{children}
		</ul>
	),

	ol: ({ children }) => (
		<ol className="list-decimal list-outside ml-5 md:ml-6 mb-5 md:mb-6 space-y-1.5 md:space-y-2 text-primary-700 marker:text-accent-500 font-medium">
			{children}
		</ol>
	),

	li: ({ children }) => <li className="leading-relaxed pl-1 wrap-break-word">{children}</li>,

	blockquote: ({ children }) => (
		<blockquote className="relative my-6 md:my-8 pl-4 md:pl-6 py-3 md:py-4 pr-3 md:pr-4 border-l-4 border-accent-500 rounded-r-2xl bg-surface-100/50 backdrop-blur-sm italic text-primary-600 shadow-sm wrap-break-word">
			{children}
		</blockquote>
	),

	code: ({ className, children }) => {
		const isInline = !className;
		if (isInline) {
			return (
				<code className="px-1.5 py-0.5 mx-0.5 rounded text-[0.85em] font-mono align-middle bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200 whitespace-nowrap">
					{children}
				</code>
			);
		}
		return (
			<code className={className} suppressHydrationWarning>
				{children}
			</code>
		);
	},

	pre: ({ children, className: preClassName, ...props }) => {
		let language: string | undefined;

		if (children && typeof children === "object" && "props" in children) {
			const childProps = (children as { props?: { "className"?: string; "data-language"?: string } }).props;
			const codeClassName = childProps?.className;
			if (typeof codeClassName === "string") {
				const match = codeClassName.match(/language-(\w+)/);
				if (match?.[1]) {
					language = match[1];
				}
			}
			if (!language && childProps?.["data-language"]) {
				language = childProps["data-language"];
			}
		}

		// 提取纯文本内容作为 fallback
		const extractText = (node: any): string => {
			if (typeof node === "string")
				return node;
			if (Array.isArray(node))
				return node.map(extractText).join("");
			if (node?.props?.children)
				return extractText(node.props.children);
			return "";
		};

		const textContent = extractText(children);

		return (
			<CodeBlock className={preClassName} language={language} fallbackText={textContent} {...props}>
				{children}
			</CodeBlock>
		);
	},

	img: ({ src, alt }) => {
		const validSrc = typeof src === "string" ? src : "";
		return (
			<ImageFigure
				src={validSrc}
				alt={alt}
				isBlock={false}
			/>
		);
	},

	table: ({ children }) => (
		<div className="my-6 md:my-8 w-full overflow-x-auto rounded-xl border border-primary-200 shadow-sm scrollbar-thin">
			<table className="min-w-full divide-y divide-primary-200 text-left text-xs md:text-sm">{children}</table>
		</div>
	),

	thead: ({ children }) => (
		<thead className="bg-primary-50 font-semibold text-primary-900">{children}</thead>
	),

	tbody: ({ children }) => (
		<tbody className="divide-y divide-primary-200 bg-transparent">{children}</tbody>
	),

	tr: ({ children }) => (
		<tr className="transition-colors hover:bg-primary-50/50">
			{children}
		</tr>
	),

	th: ({ children }) => (
		<th className="px-3 md:px-4 py-2 md:py-3 text-left font-medium tracking-wider whitespace-nowrap">{children}</th>
	),

	td: ({ children }) => (
		<td className="px-3 md:px-4 py-2 md:py-3 text-primary-700 align-top whitespace-normal leading-relaxed min-w-30">
			{children}
		</td>
	),

	hr: () => <hr className="my-10 md:my-12 border-dashed border-primary-200 w-1/2 mx-auto" />,

	div: ({ children, ...props }) => {
		const containerType = (props as any)["data-container-type"];
		const containerParams = (props as any)["data-container-params"];
		const mermaidChart = (props as any)["data-mermaid-chart"];

		if (containerType) {
			// 提取原始文本内容用于图片解析
			const extractText = (node: any): string => {
				if (typeof node === "string")
					return node;
				if (Array.isArray(node))
					return node.map(extractText).join("\n");
				if (node?.props?.children)
					return extractText(node.props.children);
				return "";
			};

			const rawContent = extractText(children);

			return (
				<ContainerBlock type={containerType} params={containerParams} rawContent={rawContent}>
					{children}
				</ContainerBlock>
			);
		}

		if (mermaidChart) {
			return <MermaidDiagram chart={decodeURIComponent(mermaidChart)} />;
		}

		return <div {...props}>{children}</div>;
	},

	span: ({ className, children, ...props }) => {
		const { node: _node, ...rest } = props as any;

		if (className === "spoiler") {
			return <Spoiler>{children}</Spoiler>;
		}

		const { id: _id, ...restWithoutId } = rest;

		return (
			<span className={className} {...restWithoutId} suppressHydrationWarning>
				{children}
			</span>
		);
	},

	script: ({ children, ...props }) => {
		return <ClientOnlyScript {...props}>{children}</ClientOnlyScript>;
	},

	p: ({ children }) => {
		const standaloneImage = getStandaloneImageProps(children);

		if (standaloneImage) {
			return (
				<ImageFigure
					src={standaloneImage.src}
					alt={standaloneImage.alt}
					isBlock={true}
				/>
			);
		}

		const isTextOnly = isTextOnlyContent(children);

		return (
			<p className="text-[15px] md:text-lg leading-relaxed text-primary-700 mb-5 md:mb-6 last:mb-0 wrap-break-word">
				{isTextOnly ? <AbbreviationText>{children}</AbbreviationText> : children}
			</p>
		);
	},

};

export async function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
	// Check if content contains math formulas
	const hasMath = /\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([^)]+?\\\)/.test(content);

	const usedLanguages = new Set<string>();

	const codeBlockRegex = /(?:^|\n)(?:```|~~~)\s*([\w-]+)/g;

	let match = codeBlockRegex.exec(content);
	while (match !== null) {
		if (match[1])
			usedLanguages.add(match[1].toLowerCase());
		match = codeBlockRegex.exec(content);
	}

	const highlighter = await getHighlighter(Array.from(usedLanguages));
	const rehypePlugins: any[] = [
		rehypeRaw,
		rehypeSlug,
		[
			rehypeShikiFromHighlighter,
			highlighter,
			{
				themes: {
					light: "light-plus",
					dark: "dark-plus",
				},
				addLanguageClass: true,
			},
		],
	];

	// Only add KaTeX plugin if math is detected
	if (hasMath) {
		rehypePlugins.push([
			rehypeKatex,
			{
				trust: true,
				strict: false,
				output: "html",
				macros: {
					// 启用物理包的常用宏
					"\\bra": "\\langle #1|",
					"\\ket": "|#1\\rangle",
					"\\braket": "\\langle #1 \\rangle",
					"\\dd": "\\mathrm{d}",
					"\\dv": "\\frac{\\mathrm{d} #1}{\\mathrm{d} #2}",
					"\\pdv": "\\frac{\\partial #1}{\\partial #2}",
					"\\abs": "\\left| #1 \\right|",
					"\\norm": "\\left\\| #1 \\right\\|",
					"\\eval": "\\left. #1 \\right|_{#2}",
					"\\order": "\\mathcal{O}\\left( #1 \\right)",
					"\\comm": "\\left[ #1, #2 \\right]",
					"\\acomm": "\\left\\{ #1, #2 \\right\\}",
					"\\vb": "\\mathbf{#1}",
					"\\vdot": "\\cdot",
					"\\cross": "\\times",
					"\\grad": "\\nabla",
					"\\div": "\\nabla \\cdot",
					"\\curl": "\\nabla \\times",
					"\\laplacian": "\\nabla^2",
				},
			},
		]);
	}

	return (
		<>
			{hasMath && <KatexStyles />}
			<div className={`markdown-body ${className}`}>
				<ReactMarkdown
					remarkPlugins={[remarkGfm, remarkBreaks, remarkMathDelimiters, remarkMath, remarkSpoiler, remarkMermaid, remarkContainer]}
					rehypePlugins={rehypePlugins}
					components={components}
				>
					{content}
				</ReactMarkdown>
			</div>
		</>
	);
}
