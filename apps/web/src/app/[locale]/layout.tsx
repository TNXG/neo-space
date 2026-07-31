import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { JetBrains_Mono, Noto_Sans_SC } from "next/font/google";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/common/theme";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { generateWebsiteJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteConfig } from "@/lib/api-client";
import { routing } from "@/locales";

const notoSans = Noto_Sans_SC({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const OPEN_GRAPH_LOCALE: Record<string, string> = {
  zh: "zh_CN",
  ja: "ja_JP",
  en: "en_US",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

export async function generateMetadata({ params }: LocaleLayoutProps): Promise<Metadata> {
  const { locale } = await params;
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
      openGraph: {
        type: "website",
        locale: OPEN_GRAPH_LOCALE[locale] ?? OPEN_GRAPH_LOCALE.zh,
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
      },
    };
  } catch {
    return {
      metadataBase: new URL(baseUrl),
      title: { template: "%s - Blog", default: "Blog" },
      description: "Personal blog powered by Neo-Space",
    };
  }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";
  let jsonLdData;
  try {
    const configResponse = await getSiteConfig();
    const { seo } = configResponse.data;
    jsonLdData = generateWebsiteJsonLd({
      name: seo.title,
      description: seo.description,
      url: baseUrl,
    });
  } catch {
    jsonLdData = generateWebsiteJsonLd({
      name: "Blog",
      description: "Personal blog powered by Neo-Space",
      url: baseUrl,
    });
  }

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`
          ${notoSans.variable} 
          ${jetbrainsMono.variable} 
          selection:bg-accent-500/30 
          selection:text-primary-900 
          font-sans
        `}
      >
        {/*
         * 防主题闪烁脚本：在 body 解析时同步执行，早于 React 水合，
         * 避免 next-themes 接管前出现亮/暗模式闪屏。
         * 逻辑与 next-themes 默认配置对齐（attribute=class, storageKey=theme,
         * defaultTheme=system, enableSystem, themes=[light,dark]）。
         */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var n=localStorage.getItem('theme')||'system';var t=n==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):n;d.classList.remove('light','dark');d.classList.add(t);d.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
        <JsonLd data={jsonLdData} />
        {" "}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <MotionProvider>
            <NextIntlClientProvider messages={messages}>
              <TooltipProvider>
                {children}
                <Toaster richColors position="top-center" />
              </TooltipProvider>
            </NextIntlClientProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
