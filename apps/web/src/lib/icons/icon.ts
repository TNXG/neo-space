import type { FC } from "react";

import type { IconProps } from "./file-icons";
import {
  AliyunIcon,
  ApacheIcon,
  AstroIcon,
  AwsIcon,
  AzureIcon,
  BilibiliIcon,
  CaddyIcon,
  CloudflareIcon,
  CreativeCommonsIcon,
  DenoIcon,
  EdgeOneIcon,
  FlyIcon,
  GcpIcon,
  GitHubIcon,
  GoIcon,
  GoogleIcon,
  HerokuIcon,
  HexoIcon,
  Html5Icon,
  HugoIcon,
  JavaScriptIcon,
  LiteSpeedIcon,
  MdnWebDocsIcon,
  MicrosoftIcon,
  NetlifyIcon,
  NextjsIcon,
  NginxIcon,
  NodejsIcon,
  NuxtIcon,
  PhpIcon,
  PythonIcon,
  QQIcon,
  QuicCloudIcon,
  RailwayIcon,
  ReactIcon,
  RenderIcon,
  RustIcon,
  SolidIcon,
  SvelteIcon,
  TencentCloudIcon,
  TypeScriptIcon,
  V2exIcon,
  VercelIcon,
  VitePressIcon,
  VueIcon,
  WechatIcon,
  WordPressIcon,
  ZhihuIcon,
} from "./file-icons";

/** 友链架构图标映射 */
// @keep-sorted
export const archIcons: Record<string, FC<IconProps>> = {
  "Astro": AstroIcon,
  "Cloudflare": CloudflareIcon,
  "Deno Deploy": DenoIcon,
  "Deno": DenoIcon,
  "GitHub Pages": GitHubIcon,
  "Go": GoIcon,
  "Golang": GoIcon,
  "Hexo": HexoIcon,
  "HTML": Html5Icon,
  "Hugo": HugoIcon,
  "JavaScript": JavaScriptIcon,
  "Netlify": NetlifyIcon,
  "Next.js": NextjsIcon,
  "Node.js": NodejsIcon,
  "Nuxt.js": NuxtIcon,
  "Nuxt": NuxtIcon,
  "PHP": PhpIcon,
  "Python": PythonIcon,
  "React": ReactIcon,
  "Rust": RustIcon,
  "Solid": SolidIcon,
  "SolidJS": SolidIcon,
  "Svelte": SvelteIcon,
  "SvelteKit": SvelteIcon,
  "TypeScript": TypeScriptIcon,
  "Vercel": VercelIcon,
  "VitePress": VitePressIcon,
  "Vue.js": VueIcon,
  "Vue": VueIcon,
  "WordPress": WordPressIcon,
};

export type Arch = keyof typeof archIcons;

/**
 * 获取架构对应的图标组件
 */
export function getArchIcon(arch: string): FC<IconProps> | null {
  return archIcons[arch] ?? null;
}

/** 托管服务商图标映射 (对应后端 HostingProvider 枚举) */
// @keep-sorted
export const hostingIcons: Record<string, FC<IconProps> | null> = {
  aliyun: AliyunIcon,
  aliyuncdn: AliyunIcon,
  aliyunesa: AliyunIcon,
  apache: ApacheIcon,
  aws: AwsIcon,
  azure: AzureIcon,
  caddy: CaddyIcon,
  cloudflare: CloudflareIcon,
  fly: FlyIcon,
  gcp: GcpIcon,
  github: GitHubIcon,
  heroku: HerokuIcon,
  litespeed: LiteSpeedIcon,
  netlify: NetlifyIcon,
  nginx: NginxIcon,
  openresty: NginxIcon,
  quiccloud: QuicCloudIcon,
  railway: RailwayIcon,
  render: RenderIcon,
  tencent: TencentCloudIcon,
  tencentcdn: TencentCloudIcon,
  tencentedgeone: EdgeOneIcon,
  tencentedgeonepages: EdgeOneIcon,
  unknown: null,
  vercel: VercelIcon,
};

export type HostingProvider = keyof typeof hostingIcons;

/** 托管服务商友好名称映射 */
// @keep-sorted
export const hostingDisplayNames: Record<string, string> = {
  aliyun: "阿里云",
  aliyuncdn: "阿里云 CDN",
  aliyunesa: "阿里云 ESA",
  apache: "Apache",
  aws: "AWS",
  azure: "Azure",
  caddy: "Caddy",
  cloudflare: "Cloudflare",
  fly: "Fly.io",
  gcp: "Google Cloud",
  github: "GitHub Pages",
  heroku: "Heroku",
  litespeed: "LiteSpeed",
  netlify: "Netlify",
  nginx: "Nginx",
  openresty: "OpenResty",
  quiccloud: "QUIC.cloud",
  railway: "Railway",
  render: "Render",
  tencent: "腾讯云",
  tencentcdn: "腾讯云 CDN",
  tencentedgeone: "EdgeOne",
  tencentedgeonepages: "EdgeOne Pages",
  unknown: "未知",
  vercel: "Vercel",
};

/**
 * 获取托管服务商的友好显示名称
 */
export function getHostingDisplayName(provider: string): string {
  const normalizedProvider = provider.toLowerCase();

  // 直接映射
  if (hostingDisplayNames[normalizedProvider]) {
    return hostingDisplayNames[normalizedProvider];
  }

  // 别名映射（处理可能的变体）
  const aliasMap: Record<string, string> = {
    // Tencent 相关
    "tencent-edgeone": "tencentedgeone",
    "tencent_edgeone": "tencentedgeone",
    "edgeone": "tencentedgeone",
    "tencent-edgeone-pages": "tencentedgeonepages",
    "tencent_edgeone_pages": "tencentedgeonepages",
    "edgeone-pages": "tencentedgeonepages",
    "tencent-cdn": "tencentcdn",
    "tencent_cdn": "tencentcdn",

    // Aliyun 相关
    "aliyun-esa": "aliyunesa",
    "aliyun_esa": "aliyunesa",
    "esa": "aliyunesa",
    "aliyun-cdn": "aliyuncdn",
    "aliyun_cdn": "aliyuncdn",
    "alibaba": "aliyun",
    "alibabacloud": "aliyun",

    // 其他常见别名
    "github-pages": "github",
    "github_pages": "github",
    "githubpages": "github",
    "lite-speed": "litespeed",
    "lite_speed": "litespeed",
    "open-resty": "openresty",
    "open_resty": "openresty",
    "quic-cloud": "quiccloud",
    "quic_cloud": "quiccloud",
    "quic.cloud": "quiccloud",
  };

  const aliasKey = aliasMap[normalizedProvider];
  if (aliasKey && hostingDisplayNames[aliasKey]) {
    return hostingDisplayNames[aliasKey];
  }

  // 如果没有找到映射，返回原始值（首字母大写）
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

/**
 * 获取托管服务商对应的图标组件
 */
export function getHostingIcon(provider: string): FC<IconProps> | null {
  const normalizedProvider = provider.toLowerCase();

  // 直接映射
  if (hostingIcons[normalizedProvider]) {
    return hostingIcons[normalizedProvider];
  }

  // 别名映射（处理可能的变体）
  const aliasMap: Record<string, string> = {
    // Tencent 相关
    "tencent-edgeone": "tencentedgeone",
    "tencent_edgeone": "tencentedgeone",
    "edgeone": "tencentedgeone",
    "tencent-edgeone-pages": "tencentedgeonepages",
    "tencent_edgeone_pages": "tencentedgeonepages",
    "edgeone-pages": "tencentedgeonepages",
    "tencent-cdn": "tencentcdn",
    "tencent_cdn": "tencentcdn",

    // Aliyun 相关
    "aliyun-esa": "aliyunesa",
    "aliyun_esa": "aliyunesa",
    "esa": "aliyunesa",
    "aliyun-cdn": "aliyuncdn",
    "aliyun_cdn": "aliyuncdn",
    "alibaba": "aliyun",
    "alibabacloud": "aliyun",

    // 其他常见别名
    "github-pages": "github",
    "github_pages": "github",
    "githubpages": "github",
    "lite-speed": "litespeed",
    "lite_speed": "litespeed",
    "open-resty": "openresty",
    "open_resty": "openresty",
    "quic-cloud": "quiccloud",
    "quic_cloud": "quiccloud",
    "quic.cloud": "quiccloud",
  };

  const aliasKey = aliasMap[normalizedProvider];
  if (aliasKey && hostingIcons[aliasKey]) {
    return hostingIcons[aliasKey];
  }

  return null;
}

/** 主域名图标映射 */
// @keep-sorted
const mainDomainIcons: Record<string, FC<IconProps>> = {
  "bilibili.com": BilibiliIcon,
  "creativecommons.org": CreativeCommonsIcon,
  "github.com": GitHubIcon,
  "github.io": GitHubIcon,
  "google.cn": GoogleIcon,
  "google.com": GoogleIcon,
  "microsoft.com": MicrosoftIcon,
  "netlify.app": NetlifyIcon,
  "pages.dev": CloudflareIcon,
  "qq.com": QQIcon,
  "v2ex.com": V2exIcon,
  "vercel.app": VercelIcon,
  "zhihu.com": ZhihuIcon,
};

/** 专门域名图标映射，优先级高于主域名图标 */
// @keep-sorted
const domainIcons: Record<string, FC<IconProps>> = {
  "developer.mozilla.org": MdnWebDocsIcon,
  "mp.weixin.qq.com": WechatIcon,
};

/**
 * 获取域名对应的图标组件
 */
export function getDomainIcon(url: string): FC<IconProps> | null {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;

    // 检查专门域名图标
    if (domain in domainIcons) {
      return domainIcons[domain];
    }

    // 提取主域名（例如：从 www.example.com 提取 example.com）
    const parts = domain.split(".");
    const mainDomain = parts.length >= 2
      ? parts.slice(-2).join(".")
      : domain;

    return mainDomainIcons[mainDomain] ?? null;
  } catch {
    return null;
  }
}
