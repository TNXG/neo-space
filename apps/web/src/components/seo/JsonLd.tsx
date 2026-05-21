/* eslint-disable react-refresh/only-export-components */

/**
 * JSON-LD 结构化数据组件
 * 用于提供搜索引擎更丰富的页面信息
 */
export function JsonLd({ data }: { data: Record<string, any> }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/**
 * 生成文章的 JSON-LD 数据
 */
export function generateArticleJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  authorName,
  keywords,
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  authorName: string;
  keywords?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": title,
    description,
    url,
    datePublished,
    "dateModified": dateModified || datePublished,
    "author": {
      "@type": "Person",
      "name": authorName,
    },
    "keywords": keywords?.join(", "),
  };
}

/**
 * 生成网站的 JSON-LD 数据
 */
export function generateWebsiteJsonLd({
  name,
  description,
  url,
}: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    description,
    url,
  };
}

/**
 * 生成面包屑导航的 JSON-LD 数据
 */
export function generateBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url,
    })),
  };
}
