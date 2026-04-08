import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/common/theme";
import { generateWebsiteJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteConfig } from "@/lib/api-client";
import { routing } from "@/locales";

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
        googleBot: {
          "index": true,
          "follow": true,
          "max-video-preview": -1,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
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

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";
  const messages = await getMessages();

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
    <>
      <JsonLd data={jsonLd} />
      <NextIntlClientProvider messages={messages}>
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
      </NextIntlClientProvider>
    </>
  );
}
