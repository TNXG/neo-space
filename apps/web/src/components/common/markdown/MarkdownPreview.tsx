import type { Components } from "react-markdown";
import { getTranslations } from "next-intl/server";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkFlexibleMarkers from "remark-flexible-markers";
import remarkGfm from "remark-gfm";

import { Mark } from "../content/Mark";
import { truncateText } from "./utils";

// Static regex patterns to avoid re-compilation
const LANGUAGE_CLASS_REGEX = /language-(\w+)/;

/**
 * 预览模式的组件样式（简化，图片和代码块用文字替代）
 * 使用中间色调文字确保可读性
 */
function createPreviewComponents(t: Awaited<ReturnType<typeof getTranslations>>): Components {
  return {
    p: ({ children }) => <p>{children}</p>,
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
    img: () => <span className="text-muted-foreground italic">{t("common.markdown.imagePlaceholder")}</span>,
    pre: ({ children }) => {
      let lang = "";
      if (children && typeof children === "object" && "props" in children) {
        const codeProps = (children as any).props;
        const className = codeProps?.className || "";
        const match = LANGUAGE_CLASS_REGEX.exec(className);
        if (match)
          lang = match[1];
      }
      return (
        <span className="text-muted-foreground italic">
          {lang ? t("common.markdown.codeWithLanguage", { lang }) : t("common.markdown.codeBlock")}
        </span>
      );
    },
    code: ({ children }) => (
      <code className="bg-muted px-1 rounded text-sm">
        {children}
      </code>
    ),
    table: () => <span className="text-muted-foreground italic">{t("common.markdown.tablePlaceholder")}</span>,
    hr: () => null,
    mark: ({ children }) => <Mark>{children}</Mark>,
  };
}

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
  const t = await getTranslations();
  const truncated = truncateText(content, maxLength);
  const previewComponents = createPreviewComponents(t);

  // 自定义 sanitize schema，允许 mark 标签
  const sanitizeSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), "mark"],
  };

  return (
    <span className="text-foreground/70 **:text-inherit">
      <ReactMarkdown
        remarkPlugins={[remarkFlexibleMarkers, remarkGfm, remarkBreaks]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, sanitizeSchema],
        ]}
        components={previewComponents}
      >
        {truncated}
      </ReactMarkdown>
    </span>
  );
}
