import type { Components } from "react-markdown";
import type { MediaCardData } from "./plugins/media-card";

import { DashedSeparator } from "@/components/ui/separator";

import { Icon } from "@/lib/inline-icon";

import { AnimatedLink } from "../content/AnimatedLink";
import { ClientOnlyScript } from "../content/ClientOnlyScript";
import { CodeBlock } from "../content/CodeBlock";
import { ContainerBlock } from "../content/ContainerBlock";
import { Details } from "../content/Details";
import { EnhancedHeading } from "../content/EnhancedHeading";
import { FootnoteReference } from "../content/Footnote/FootnoteReference";
import { ImageFigure } from "../content/ImageFigure";
import { Mark } from "../content/Mark";
import { MermaidDiagram } from "../content/MermaidDiagram";
import { Spoiler } from "../content/Spoiler";
import { getMediaCardUrlFromProps } from "./plugins/media-card";
import { MediaCard } from "./plugins/media-card/MediaCard";
import { PROSE_CLASSES } from "./prose-classes";
import { getStandaloneImageProps } from "./utils";

const LANGUAGE_CLASS_REGEX = /language-(\w+)/;

/**
 * 站点正文组件映射；服务端与后台实时预览共用，保证所见即发布所得。
 * @param mediaCards 服务端预取的影视卡片数据，客户端传空 Map 时由卡片自行加载
 * @returns react-markdown 组件映射
 */
export const createMarkdownComponents = (mediaCards: Map<string, MediaCardData> = new Map()): Components => ({
  h1: ({ children, id }) => (
    <EnhancedHeading
      id={id}
      level={1}
      className={PROSE_CLASSES.h1}
    >
      {children}
    </EnhancedHeading>
  ),
  h2: ({ children, id }) => (
    <EnhancedHeading
      id={id}
      level={2}
      className={PROSE_CLASSES.h2}
    >
      {children}
    </EnhancedHeading>
  ),
  h3: ({ children, id }) => (
    <EnhancedHeading
      id={id}
      level={3}
      className={PROSE_CLASSES.h3}
    >
      {children}
    </EnhancedHeading>
  ),
  h4: ({ children, id }) => (
    <EnhancedHeading
      id={id}
      level={4}
      className={PROSE_CLASSES.h4}
    >
      {children}
    </EnhancedHeading>
  ),

  a: ({ href, children, ...props }) => {
    const footnoteRef = (props as any)["data-footnote-ref"];
    const footnoteBackref = (props as any)["data-footnote-backref"];
    const isInternal = href?.startsWith("/") || href?.startsWith("#");

    // 脚注回跳按钮：使用 iconify 图标替代 ↩
    if (footnoteBackref) {
      return (
        <a
          data-footnote-backref="true"
          data-footnote-id={(props as any)["data-footnote-id"]}
          href={href || "#"}
          aria-label={(props as any)["aria-label"]}
        >
          <Icon icon="mingcute:arrow-left-up-line" className="size-3.5" aria-hidden />
        </a>
      );
    }

    // 正文脚注引用徽标：样式完全由 FootnoteNavigator CSS 选择器控制
    if (footnoteRef) {
      return (
        <FootnoteReference
          id={(props as any).id}
          footnoteId={(props as any)["data-footnote-id"]}
          href={href}
          ariaLabel={(props as any)["aria-label"]}
        >
          {children}
        </FootnoteReference>
      );
    }

    // 普通链接（含脚注正文中的链接）：统一使用 AnimatedLink 保持渲染一致性
    return (
      <AnimatedLink
        href={href || "#"}
        className={PROSE_CLASSES.link}
        target={isInternal ? "_self" : "_blank"}
        rel={isInternal ? undefined : "noopener noreferrer"}
      >
        {children}
      </AnimatedLink>
    );
  },

  ul: ({ children }) => (
    <ul className={PROSE_CLASSES.ul}>
      {children}
    </ul>
  ),

  ol: ({ children, ...props }) => {
    const isFootnoteList = (props as any).className?.includes?.("footnote-list");
    return (
      <ol
        {...props}
        className={isFootnoteList
          ? "footnote-list list-[upper-roman] list-outside ml-5 md:ml-6 mb-5 md:mb-6 space-y-3 text-primary-700 marker:text-accent-500 font-medium"
          : PROSE_CLASSES.ol}
      >
        {children}
      </ol>
    );
  },

  li: ({ children, ...props }) => {
    const isFootnoteItem = (props as any)["data-footnote-item"];
    return (
      <li
        {...props}
        className={isFootnoteItem
          ? "leading-relaxed wrap-break-word text-sm md:text-base"
          : PROSE_CLASSES.li}
      >
        {children}
      </li>
    );
  },

  blockquote: ({ children }) => (
    <blockquote className={PROSE_CLASSES.blockquote}>
      {children}
    </blockquote>
  ),

  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className={PROSE_CLASSES.inlineCode}>
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

    if (typeof preClassName === "string") {
      const preMatch = preClassName.match(LANGUAGE_CLASS_REGEX);
      if (preMatch?.[1]) {
        language = preMatch[1];
      }
    }

    if (children && typeof children === "object" && "props" in children) {
      const childProps = (children as { props?: { "className"?: string; "data-language"?: string } }).props;
      const codeClassName = childProps?.className;
      if (!language && typeof codeClassName === "string") {
        const match = codeClassName.match(LANGUAGE_CLASS_REGEX);
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
    <div className={PROSE_CLASSES.tableWrapper}>
      <table className={PROSE_CLASSES.table}>{children}</table>
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
    <td className={PROSE_CLASSES.td}>
      {children}
    </td>
  ),

  hr: () => <DashedSeparator spacing="lg" />,

  div: ({ children, ...props }) => {
    const mediaCardUrl = getMediaCardUrlFromProps(props);
    const containerType = (props as any)["data-container-type"];
    const containerParams = (props as any)["data-container-params"];
    const mermaidChart = (props as any)["data-mermaid-chart"];

    if (mediaCardUrl) {
      return <MediaCard key={mediaCardUrl} url={mediaCardUrl} initialData={mediaCards.get(mediaCardUrl)} />;
    }

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

    return (
      <span className={className} {...rest} suppressHydrationWarning>
        {children}
      </span>
    );
  },

  mark: ({ children }) => <Mark>{children}</Mark>,

  details: ({ children, ...props }) => <Details {...props}>{children}</Details>,

  script: ({ node, ...props }) => {
    // 从 hast 节点直接提取原始脚本文本（比 React children 更可靠，
    // 不受 rehype 插件加工影响）
    const extractText = (n: any): string => {
      if (!n)
        return "";
      if (n.type === "text")
        return n.value || "";
      if (n.children)
        return n.children.map(extractText).join("");
      return "";
    };
    const scriptContent = node ? extractText(node) : undefined;

    // 只传递可序列化的 HTML 属性（过滤 node / children 等 React 内部属性）
    const { children: _c, className: _cls, ...htmlAttrs } = props as any;
    return <ClientOnlyScript scriptContent={scriptContent} {...htmlAttrs} />;
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

    return (
      <p className={PROSE_CLASSES.p}>
        {children}
      </p>
    );
  },

});
