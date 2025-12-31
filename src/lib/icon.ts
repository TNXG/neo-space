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
export const hostingIcons: Record<string, FC<IconProps>> = {
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
  railway: RailwayIcon,
  render: RenderIcon,
  tencent: TencentCloudIcon,
  tencentcdn: TencentCloudIcon,
  tencentedgeone: EdgeOneIcon,
  tencentedgeonepages: EdgeOneIcon,
  vercel: VercelIcon,
};

export type HostingProvider = keyof typeof hostingIcons;

/**
 * 获取托管服务商对应的图标组件
 */
export function getHostingIcon(provider: string): FC<IconProps> | null {
  return hostingIcons[provider.toLowerCase()] ?? null;
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
