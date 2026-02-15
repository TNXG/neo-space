/* eslint-disable react-refresh/only-export-components */

import type { SVGProps } from "react";
import * as React from "react";
import { useEffect, useMemo, useState } from "react";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

type IconCollectionLoader = () => Promise<any>;

const ext2lang: Record<string, string> = {
  js: "javascript",
  jsx: "javascript-react",
  ts: "typescript",
  tsx: "typescript-react",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  html: "html",
  css: "css",
  json: "json",
  md: "markdown",
  sh: "bash",
  yaml: "yaml",
  xml: "xml",
  sql: "database",
  vue: "vue",
  react: "javascript-react",
  dockerfile: "docker",
  makefile: "makefile",
};

// 集中管理动态导入，方便扩展
const collectionLoaders: Record<string, IconCollectionLoader> = {
  "simple-icons": () => import("@iconify-json/simple-icons/icons.json"),
  "mingcute": () => import("@iconify-json/mingcute/icons.json"),
  "catppuccin": () => import("@iconify-json/catppuccin/icons.json"),
};

// --- 通用组件与 Hooks ---

/**
 * 基础 SVG 渲染组件，处理通用样式和属性
 */
const BaseSvg: React.FC<IconProps & { html?: string }> = ({
  size = "1em",
  color,
  className,
  style,
  html,
  children,
  fill,
  ...props
}) => {
  // 优先使用 props 中的 fill，其次 color，最后 currentColor
  const fillColor = fill || color || "currentColor";

  const commonProps = {
    xmlns: "http://www.w3.org/2000/svg",
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className,
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      overflow: "visible",
      color: fillColor, // 使用 color 属性，让内部的 currentColor 继承
      ...style,
    },
    ...props,
  };

  if (html) {
    // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
    return <svg {...commonProps} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return <svg {...commonProps} fill={fillColor}>{children}</svg>;
};

/**
 * 通用图标加载逻辑 Hook
 */
function useIconLoader(
  collectionName: string,
  iconKey?: string,
  fallbackKey?: string,
) {
  const [svgBody, setSvgBody] = useState<string>("");

  useEffect(() => {
    if (!iconKey || !collectionLoaders[collectionName])
      return;

    let isMounted = true;

    const load = async () => {
      try {
        // 并行加载图标数据和工具函数
        const [iconsModule, utilsModule] = await Promise.all([
          collectionLoaders[collectionName](),
          import("@iconify/utils"),
        ]);

        const icons = iconsModule.default;
        const { getIconData, iconToSVG } = utilsModule;

        // 尝试获取图标数据，如果不存在则尝试 fallback
        let iconData = getIconData(icons, iconKey);
        if (!iconData && fallbackKey) {
          iconData = getIconData(icons, fallbackKey);
        }

        if (iconData && isMounted) {
          const { body } = iconToSVG(iconData);
          setSvgBody(body);
        }
      } catch (error) {
        console.error(`Failed to load icon ${collectionName}:${iconKey}`, error);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [collectionName, iconKey, fallbackKey]);

  return svgBody;
}

function createIconComponent(
  collection: string,
  iconKey: string,
  defaultColor?: string,
): React.FC<IconProps> {
  const IconComponent: React.FC<IconProps> = (props) => {
    const svgBody = useIconLoader(collection, iconKey);
    if (!svgBody)
      return null;
    return <BaseSvg {...props} color={props.color || defaultColor} html={svgBody} />;
  };
  IconComponent.displayName = `Icon(${collection}:${iconKey})`;
  return IconComponent;
}

export function FileIcon({ extension, ...props }: { extension?: string } & IconProps) {
  const iconKey = useMemo(() => {
    if (!extension)
      return undefined;
    const normalizedExt = extension.toLowerCase();
    return ext2lang[normalizedExt] || normalizedExt;
  }, [extension]);

  const svgBody = useIconLoader("catppuccin", iconKey, "file");

  if (!extension || !svgBody)
    return null;

  return <BaseSvg {...props} html={svgBody} />;
}

// 辅助生成函数
const createSimpleIcon = (key: string, color?: string) => createIconComponent("simple-icons", key, color);
const createMingcuteIcon = (key: string, color?: string) => createIconComponent("mingcute", key, color);

// --- 静态 SVG 图标 (保留原样，但复用 BaseSvg 以保持样式一致) ---

export const EdgeOneIcon: React.FC<IconProps> = ({ color = "#0055D2", ...props }) => (
  <BaseSvg fill="none" {...props}>
    <path d="M29.8101 18.138C29.9349 17.4442 30 16.7297 30 16C30 15.3831 29.9535 14.7772 29.8637 14.1854C29.829 13.9567 29.6296 13.792 29.3983 13.792H21.6802C21.4277 13.792 21.2439 13.5525 21.3093 13.3086L22.2229 9.89892C22.2904 9.6471 22.5185 9.472 22.7792 9.472H27.3634C27.668 9.472 27.8488 9.13574 27.6682 8.89047C25.4834 5.9244 21.9664 4 18 4C11.3726 4 6 9.37258 6 16C6 19.0173 7.11361 21.7745 8.95224 23.883C9.14804 24.1076 9.5076 24.0146 9.58436 23.7268L12.2394 13.7702C12.2882 13.5874 12.1504 13.408 11.9612 13.408H9.65504C9.40274 13.408 9.21899 13.1689 9.284 12.9251L10.0327 10.1174C10.0889 9.90673 10.28 9.76117 10.498 9.75666C13.0104 9.70465 15.493 9.04698 17.6975 7.84351C17.9253 7.71913 18.2007 7.92739 18.1338 8.1782L13.2499 26.4929C13.177 26.7664 13.313 27.0538 13.5761 27.1582C14.9451 27.7014 16.4377 28 18 28C21.7878 28 25.1656 26.2451 27.3649 23.5039C27.5597 23.2611 27.3809 22.912 27.0696 22.912H19.2365C18.984 22.912 18.8002 22.6725 18.8656 22.4286L19.7792 19.0189C19.8467 18.7671 20.0749 18.592 20.3356 18.592H29.2564C29.5268 18.592 29.7622 18.4042 29.8101 18.138Z" fill={color} />
  </BaseSvg>
);

export const TencentCloudIcon: React.FC<IconProps> = props => (
  <BaseSvg fill="none" {...props}>
    <path d="M20 13.0778C19.6444 13.4333 18.9333 13.9667 17.6889 13.9667C17.1556 13.9667 16.5333 13.9667 16.2667 13.9667C15.9111 13.9667 13.2444 13.9667 10.0444 13.9667C12.3556 11.7444 14.3111 9.87778 14.4889 9.7C14.6667 9.52222 15.1111 9.07778 15.5556 8.72222C16.4444 7.92222 17.1556 7.83333 17.7778 7.83333C18.6667 7.83333 19.3778 8.18889 20 8.72222C21.2444 9.87778 21.2444 11.9222 20 13.0778ZM21.5111 7.28889C20.6222 6.31111 19.2889 5.68889 17.8667 5.68889C16.6222 5.68889 15.5556 6.13333 14.5778 6.84444C14.2222 7.2 13.6889 7.55556 13.2444 8.08889C12.8889 8.44444 5.24444 15.9222 5.24444 15.9222C5.68889 16.0111 6.22222 16.0111 6.66667 16.0111C7.11111 16.0111 16 16.0111 16.3556 16.0111C17.0667 16.0111 17.6 16.0111 18.1333 15.9222C19.2889 15.8333 20.4444 15.3889 21.4222 14.5L21.5111 14.4111C23.5556 12.5444 23.5556 9.25556 21.5111 7.28889Z" fill="#00A3FF" />
    <path d="M9.06667 6.75556C8.08889 6.04444 7.11111 5.68889 5.95556 5.68889C4.53333 5.68889 3.2 6.31111 2.31111 7.28889C0.355556 9.34444 0.355556 12.5444 2.4 14.5889C3.28889 15.3889 4.17778 15.8333 5.24444 15.9222L7.28889 13.9667C6.93333 13.9667 6.48889 13.9667 6.13333 13.9667C4.97778 13.8778 4.26667 13.5222 3.82222 13.0778C2.57778 11.8333 2.57778 9.87778 3.73333 8.63333C4.35556 8.01111 5.06667 7.74444 5.95556 7.74444C6.48889 7.74444 7.28889 7.83333 8.08889 8.63333C8.44444 8.98889 9.42222 9.7 9.77778 10.0556L9.86667 10.0556L11.2 8.72222L11.2 8.63333C10.5778 8.01111 9.6 7.21111 9.06667 6.75556" fill="#00C8DC" />
    <path d="M18.4 4.53333C17.4222 1.86667 14.8444 0 11.9111 0C8.44444 0 5.68889 2.57778 5.15556 5.77778C5.42222 5.77778 5.68889 5.68889 6.04444 5.68889C6.4 5.68889 6.84444 5.77778 7.2 5.77778L7.2 5.77778C7.64444 3.55556 9.6 2 11.9111 2C13.8667 2 15.5556 3.11111 16.3556 4.8C16.3556 4.8 16.4444 4.88889 16.4444 4.8C17.0667 4.71111 17.7778 4.53333 18.4 4.53333C18.4 4.62222 18.4 4.62222 18.4 4.53333" fill="#006EFF" />
  </BaseSvg>
);
export const QuicCloudIcon: React.FC<IconProps> = ({ color = "#66CCCA", ...props }) => (
  <BaseSvg viewBox="-58 -13 100 65" fill="none" {...props}>
    <g>
      <path fill="#97A3AA" d="M13.705,11.807C11.18,8.489,7.516,6.351,3.383,5.79C2.682,5.699,1.968,5.648,1.263,5.648 c-2.549,0-4.992,0.609-7.263,1.807C-6.387,7.66-6.766,7.881-7.128,8.114l-0.017,0.009l-0.014,0.012l-1.259,0.946l-0.398,0.297 l0.3,0.398l3.249,4.273l0.301,0.391l0.394-0.297l0.972-0.739c0.181-0.111,0.373-0.223,0.571-0.328 c1.343-0.71,2.792-1.069,4.301-1.069c0.417,0,0.837,0.03,1.254,0.084c2.449,0.334,4.62,1.599,6.118,3.567 c1.499,1.962,2.141,4.394,1.809,6.844C9.83,27.07,5.89,30.514,1.288,30.514c-0.417,0-0.836-0.027-1.25-0.084 c-1.919-0.262-3.683-1.102-5.094-2.432c-0.153-0.146-0.307-0.301-0.463-0.465l-12.231-16.077l-0.778-1.027l-0.003,0.047 l-0.511-0.671l-0.151-0.183c-0.32-0.354-0.642-0.681-0.967-0.99c-2.476-2.336-5.574-3.814-8.958-4.276 c-0.725-0.098-1.466-0.146-2.196-0.146c-8.093,0-15.018,6.052-16.107,14.076c-0.582,4.299,0.547,8.573,3.181,12.032 c2.633,3.459,6.451,5.689,10.748,6.273c0.733,0.098,1.478,0.146,2.213,0.146c2.655,0,5.198-0.633,7.564-1.885 c0.091-0.045,0.173-0.094,0.262-0.145l0.098-0.054l0.498-0.28l-0.346-0.451l-3.301-4.336l-0.244-0.318l-0.358,0.166 c-1.333,0.626-2.746,0.943-4.199,0.943c-0.442,0-0.891-0.029-1.332-0.09c-5.413-0.736-9.22-5.739-8.486-11.151 c0.663-4.888,4.881-8.573,9.813-8.573c0.444,0,0.895,0.031,1.339,0.091c2.057,0.28,3.944,1.182,5.456,2.605 c0.167,0.16,0.334,0.328,0.496,0.505l9.613,12.633l0.776,1.02l0.006-0.051l3.131,4.118l0.146,0.178 c0.308,0.345,0.616,0.66,0.93,0.955c2.38,2.242,5.353,3.664,8.598,4.104c0.689,0.093,1.4,0.144,2.113,0.144 c7.765,0,14.408-5.813,15.456-13.511C17.31,19.228,16.229,15.125,13.705,11.807z" />
      <g>
        <path fill={color} d="M-12.902,33.371c-0.049-0.052-0.104-0.103-0.152-0.15l-6.202-8.149c-0.269-0.301-0.562-0.603-0.871-0.893 c-2.307-2.173-5.185-3.552-8.328-3.98c-0.298-0.036-0.6-0.067-0.898-0.088h-0.46l2.287,2.992c0.049,0.048,0.104,0.105,0.152,0.155 l6.202,8.145c0.27,0.301,0.562,0.606,0.872,0.896c2.306,2.173,5.185,3.549,8.326,3.974c0.303,0.038,0.603,0.069,0.901,0.092h0.458 L-12.902,33.371z" />
      </g>
    </g>
  </BaseSvg>
);

// --- Simple Icons ---
// @keep-sorted
export const AliyunIcon = createSimpleIcon("alibabacloud", "#FF6A00");
export const ApacheIcon = createSimpleIcon("apache", "#D22128");
export const AstroIcon = createSimpleIcon("astro", "#FF5D01");
export const AwsIcon = createSimpleIcon("amazonwebservices", "#232F3E");
export const AzureIcon = createSimpleIcon("microsoftazure", "#0078D4");
export const CaddyIcon = createSimpleIcon("caddy", "#22B638");
export const DenoIcon = createSimpleIcon("deno");
export const FlyIcon = createSimpleIcon("flydotio", "#7B3BE2");
export const GcpIcon = createSimpleIcon("googlecloud", "#4285F4");
export const GitHubIcon = createSimpleIcon("github");
export const GoIcon = createSimpleIcon("go", "#00ADD8");
export const HerokuIcon = createSimpleIcon("heroku", "#430098");
export const HexoIcon = createSimpleIcon("hexo", "#0E83CD");
export const Html5Icon = createSimpleIcon("html5", "#E34F26");
export const HugoIcon = createSimpleIcon("hugo", "#FF4088");
export const JavaScriptIcon = createSimpleIcon("javascript", "#F7DF1E");
export const LiteSpeedIcon = createSimpleIcon("litespeed", "#003366");
export const MdnWebDocsIcon = createSimpleIcon("mdnwebdocs");
export const MicrosoftIcon = createSimpleIcon("microsoft");
export const NetlifyIcon = createSimpleIcon("netlify", "#00C7B7");
export const NextjsIcon = createSimpleIcon("nextdotjs");
export const NginxIcon = createSimpleIcon("nginx", "#009639");
export const NodejsIcon = createSimpleIcon("nodedotjs", "#5FA04E");
export const NuxtIcon = createSimpleIcon("nuxtdotjs", "#00DC82");
export const PhpIcon = createSimpleIcon("php", "#777BB4");
export const PythonIcon = createSimpleIcon("python", "#3776AB");
export const RailwayIcon = createSimpleIcon("railway", "#0B0D0E");
export const ReactIcon = createSimpleIcon("react", "#61DAFB");
export const RenderIcon = createSimpleIcon("render", "#46E3B7");
export const RustIcon = createSimpleIcon("rust");
export const SolidIcon = createSimpleIcon("solid", "#2C4F7C");
export const SvelteIcon = createSimpleIcon("svelte", "#FF3E00");
export const TypeScriptIcon = createSimpleIcon("typescript", "#3178C6");
export const V2exIcon = createSimpleIcon("v2ex");
export const VercelIcon = createSimpleIcon("vercel");
export const VitePressIcon = createSimpleIcon("vitepress", "#5C73E7");
export const VueIcon = createSimpleIcon("vuedotjs", "#4FC08D");
export const WordPressIcon = createSimpleIcon("wordpress", "#21759B");
export const CloudflareIcon = createSimpleIcon("cloudflare", "#F38020");

// --- Mingcute Icons ---
// @keep-sorted
export const BilibiliIcon = createMingcuteIcon("bilibili-line", "#00A1D6");
export const CreativeCommonsIcon = createMingcuteIcon("creative-commons-line");
export const GoogleIcon = createMingcuteIcon("google-fill", "#4285F4");
export const QQIcon = createMingcuteIcon("qq-fill", "#12B7F5");
export const WechatIcon = createMingcuteIcon("wechat-fill", "#07C160");
export const ZhihuIcon = createMingcuteIcon("zhihu-line", "#0084FF");
