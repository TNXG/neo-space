import type { Metadata } from "next";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/common/theme";
import { generateWebsiteJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteConfig } from "@/lib/api-client";

import "./globals.css";

/**
 * 生成动态 SEO 元数据
 */
export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";

  try {
    const configResponse = await getSiteConfig();
    const { seo } = configResponse.data;

    return {
      metadataBase: new URL(baseUrl),
      title: {
        template: `%s - ${seo.title}`,
        default: seo.title,
      },
      description: seo.description,
      keywords: seo.keywords,
      authors: [{ name: seo.title }],
      creator: seo.title,
      publisher: seo.title,
      formatDetection: {
        email: false,
        address: false,
        telephone: false,
      },
      openGraph: {
        type: "website",
        locale: "zh_CN",
        url: baseUrl,
        title: seo.title,
        description: seo.description,
        siteName: seo.title,
      },
      twitter: {
        card: "summary_large_image",
        title: seo.title,
        description: seo.description,
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          "index": true,
          "follow": true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
      verification: {
        // 可以在这里添加 Google Search Console 等验证码
        // google: 'your-verification-code',
      },
    };
  } catch {
    return {
      metadataBase: new URL(baseUrl),
      title: {
        template: "%s - Blog",
        default: "Blog",
      },
      description: "Personal blog powered by Neo-Space",
      robots: {
        index: true,
        follow: true,
      },
    };
  }
}

/**
 * 根布局 - 仅包含全局 Provider 和基础 HTML 结构
 * 具体页面布局（Footer、FloatingNav、Nbnhhsh）由路由分组布局处理
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";

  // 获取站点配置用于 JSON-LD
  let jsonLd = generateWebsiteJsonLd({
    name: "Blog",
    description: "Personal blog powered by Neo-Space",
    url: baseUrl,
  });

  try {
    const configResponse = await getSiteConfig();
    const { seo } = configResponse.data;
    jsonLd = generateWebsiteJsonLd({
      name: seo.title,
      description: seo.description,
      url: baseUrl,
    });
  } catch {
    // 使用默认值
  }

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <JsonLd data={jsonLd} />
      </head>
      <body className="font-sans selection:bg-accent-500/30 selection:text-primary-900">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <TooltipProvider>
            {children}
            <Toaster richColors position="top-center" />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
