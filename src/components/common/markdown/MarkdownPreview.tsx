import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { AbbreviationText } from "@/components/common/nbnhhsh/AbbreviationText";

import { truncateText } from "./utils";

import "server-only";

/**
 * 预览模式的组件样式（简化，图片和代码块用文字替代）
 * 使用中间色调文字确保可读性
 */
const previewComponents: Components = {
	p: ({ children }) => (<p><AbbreviationText>{children}</AbbreviationText></p>),
	h1: ({ children }) => <span>{children}</span>,
	h2: ({ children }) => <span>{children}</span>,
	h3: ({ children }) => <span>{children}</span>,
	a: ({ href, children, ...props }) => <a href={href} className="text-primary hover:underline" {...props}>{children}</a>,
	ul: ({ children }) => <span>{children}</span>,
	ol: ({ children }) => <span>{children}</span>,
	li: ({ children }) => (
		<span>
			{children}
			{" "}
		</span>
	),
	blockquote: ({ children }) => <span>{children}</span>,
	// 图片替换为文字
	img: () => <span className="text-muted-foreground italic">[图片]</span>,
	// 代码块替换为文字
	pre: ({ children }) => {
		// 尝试从 code 子元素获取语言信息
		let lang = "";
		if (children && typeof children === "object" && "props" in children) {
			const codeProps = (children as any).props;
			const className = codeProps?.className || "";
			const match = /language-(\w+)/.exec(className);
			if (match)
				lang = match[1];
		}
		return (
			<span className="text-muted-foreground italic">
				{lang ? `[${lang} 代码]` : "[代码块]"}
			</span>
		);
	},
	code: ({ children }) => (
		<code className="bg-muted px-1 rounded text-sm">
			{children}
		</code>
	),
	table: () => <span className="text-muted-foreground italic">[表格]</span>,
	hr: () => null,
};

/**
 * 服务端预渲染 Markdown 预览内容
 */
export async function MarkdownPreview({
	content,
	maxLength = 150,
}: {
	content: string;
	maxLength?: number;
}): Promise<React.ReactElement> {
	const truncated = truncateText(content, maxLength);

	return (
		<span className="text-foreground/70 **:text-inherit">
			<ReactMarkdown
				remarkPlugins={[remarkGfm, remarkBreaks]}
				rehypePlugins={[
					rehypeRaw,
					rehypeSanitize,
				]}
				components={previewComponents}
			>
				{truncated}
			</ReactMarkdown>
		</span>
	);
}
