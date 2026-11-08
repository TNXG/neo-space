/* eslint-disable react-refresh/only-export-components */

import type { SVGProps } from "react";
import { useMemo } from "react";
import {
  catppuccinIconsData,
  mingcuteIconsData,
  simpleIconsData,
} from "./icon-data";

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  color?: string;
}

const CLASS_SIZE_REGEX = /\b[hw]-/;

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

// 按集合名索引静态数据，方便 createIconComponent 按名查找
const staticCollections: Record<
  string,
  Record<string, { body: string; viewBox: string }>
> = {
  "simple-icons": simpleIconsData,
  "mingcute": mingcuteIconsData,
  "catppuccin": catppuccinIconsData,
};

// --- 通用组件 ---

/**
 * 基础 SVG 渲染组件，处理通用样式和属性
 */
const BaseSvg: React.FC<IconProps & { html?: string; svgViewBox?: string }> = ({
  size = "1em",
  color,
  className,
  style,
  html,
  children,
  fill,
  svgViewBox,
  ...props
}) => {
  // 优先使用 props 中的 fill，其次 color，最后 currentColor
  const fillColor = fill || color || "currentColor";

  // 如果有 className 中包含尺寸类（h-* w-*），不设置内联尺寸，让 Tailwind 控制
  const hasClassSize = className && CLASS_SIZE_REGEX.test(className);

  const commonProps = {
    xmlns: "http://www.w3.org/2000/svg",
    width: hasClassSize ? undefined : size,
    height: hasClassSize ? undefined : size,
    viewBox: svgViewBox || "0 0 24 24",
    className,
    style: {
      ...(hasClassSize ? {} : { width: size, height: size }),
      display: "block",
      flexShrink: 0,
      overflow: "visible" as const,
      color: fillColor, // 使用 color 属性，让内部的 currentColor 继承
      ...style,
    },
    ...props,
  };

  if (html) {
    // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
    return <svg {...commonProps} dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <svg {...commonProps} fill={fillColor}>
      {children}
    </svg>
  );
};

/**
 * 从静态预提取数据中同步读取图标（无运行时 JSON 加载）
 */
function getStaticIcon(
  collectionName: string,
  iconKey?: string,
  fallbackKey?: string,
): { body: string; viewBox: string } | null {
  const collection = staticCollections[collectionName];
  if (!collection || !iconKey)
    return null;
  return (
    collection[iconKey]
    ?? (fallbackKey ? (collection[fallbackKey] ?? null) : null)
  );
}

function createIconComponent(
  collection: string,
  iconKey: string,
  defaultColor?: string,
): React.FC<IconProps> {
  // 在模块初始化时就查好数据，完全避免运行时查找开销
  const data = getStaticIcon(collection, iconKey);
  const IconComponent: React.FC<IconProps> = (props) => {
    if (!data)
      return null;
    return (
      <BaseSvg
        {...props}
        color={props.color || defaultColor}
        html={data.body}
        svgViewBox={data.viewBox}
      />
    );
  };
  IconComponent.displayName = `Icon(${collection}:${iconKey})`;
  return IconComponent;
}

export function FileIcon({
  extension,
  ...props
}: { extension?: string } & IconProps) {
  const data = useMemo(() => {
    if (!extension)
      return null;
    const normalizedExt = extension.toLowerCase();
    const iconKey = ext2lang[normalizedExt] || normalizedExt;
    return getStaticIcon("catppuccin", iconKey, "file");
  }, [extension]);

  if (!extension || !data)
    return null;

  return <BaseSvg {...props} html={data.body} svgViewBox={data.viewBox} />;
}

// 辅助生成函数
const createSimpleIcon = (key: string, color?: string) =>
  createIconComponent("simple-icons", key, color);
const createMingcuteIcon = (key: string, color?: string) =>
  createIconComponent("mingcute", key, color);

// --- 静态 SVG 图标 (保留原样，但复用 BaseSvg 以保持样式一致) ---

export const EdgeOneIcon: React.FC<IconProps> = ({
  color = "#0055D2",
  ...props
}) => (
  <BaseSvg fill="none" {...props}>
    <path
      d="M29.8101 18.138C29.9349 17.4442 30 16.7297 30 16C30 15.3831 29.9535 14.7772 29.8637 14.1854C29.829 13.9567 29.6296 13.792 29.3983 13.792H21.6802C21.4277 13.792 21.2439 13.5525 21.3093 13.3086L22.2229 9.89892C22.2904 9.6471 22.5185 9.472 22.7792 9.472H27.3634C27.668 9.472 27.8488 9.13574 27.6682 8.89047C25.4834 5.9244 21.9664 4 18 4C11.3726 4 6 9.37258 6 16C6 19.0173 7.11361 21.7745 8.95224 23.883C9.14804 24.1076 9.5076 24.0146 9.58436 23.7268L12.2394 13.7702C12.2882 13.5874 12.1504 13.408 11.9612 13.408H9.65504C9.40274 13.408 9.21899 13.1689 9.284 12.9251L10.0327 10.1174C10.0889 9.90673 10.28 9.76117 10.498 9.75666C13.0104 9.70465 15.493 9.04698 17.6975 7.84351C17.9253 7.71913 18.2007 7.92739 18.1338 8.1782L13.2499 26.4929C13.177 26.7664 13.313 27.0538 13.5761 27.1582C14.9451 27.7014 16.4377 28 18 28C21.7878 28 25.1656 26.2451 27.3649 23.5039C27.5597 23.2611 27.3809 22.912 27.0696 22.912H19.2365C18.984 22.912 18.8002 22.6725 18.8656 22.4286L19.7792 19.0189C19.8467 18.7671 20.0749 18.592 20.3356 18.592H29.2564C29.5268 18.592 29.7622 18.4042 29.8101 18.138Z"
      fill={color}
    />
  </BaseSvg>
);

export const TencentCloudIcon: React.FC<IconProps> = props => (
  <BaseSvg fill="none" {...props}>
    <path
      d="M20 13.0778C19.6444 13.4333 18.9333 13.9667 17.6889 13.9667C17.1556 13.9667 16.5333 13.9667 16.2667 13.9667C15.9111 13.9667 13.2444 13.9667 10.0444 13.9667C12.3556 11.7444 14.3111 9.87778 14.4889 9.7C14.6667 9.52222 15.1111 9.07778 15.5556 8.72222C16.4444 7.92222 17.1556 7.83333 17.7778 7.83333C18.6667 7.83333 19.3778 8.18889 20 8.72222C21.2444 9.87778 21.2444 11.9222 20 13.0778ZM21.5111 7.28889C20.6222 6.31111 19.2889 5.68889 17.8667 5.68889C16.6222 5.68889 15.5556 6.13333 14.5778 6.84444C14.2222 7.2 13.6889 7.55556 13.2444 8.08889C12.8889 8.44444 5.24444 15.9222 5.24444 15.9222C5.68889 16.0111 6.22222 16.0111 6.66667 16.0111C7.11111 16.0111 16 16.0111 16.3556 16.0111C17.0667 16.0111 17.6 16.0111 18.1333 15.9222C19.2889 15.8333 20.4444 15.3889 21.4222 14.5L21.5111 14.4111C23.5556 12.5444 23.5556 9.25556 21.5111 7.28889Z"
      fill="#00A3FF"
    />
    <path
      d="M9.06667 6.75556C8.08889 6.04444 7.11111 5.68889 5.95556 5.68889C4.53333 5.68889 3.2 6.31111 2.31111 7.28889C0.355556 9.34444 0.355556 12.5444 2.4 14.5889C3.28889 15.3889 4.17778 15.8333 5.24444 15.9222L7.28889 13.9667C6.93333 13.9667 6.48889 13.9667 6.13333 13.9667C4.97778 13.8778 4.26667 13.5222 3.82222 13.0778C2.57778 11.8333 2.57778 9.87778 3.73333 8.63333C4.35556 8.01111 5.06667 7.74444 5.95556 7.74444C6.48889 7.74444 7.28889 7.83333 8.08889 8.63333C8.44444 8.98889 9.42222 9.7 9.77778 10.0556L9.86667 10.0556L11.2 8.72222L11.2 8.63333C10.5778 8.01111 9.6 7.21111 9.06667 6.75556"
      fill="#00C8DC"
    />
    <path
      d="M18.4 4.53333C17.4222 1.86667 14.8444 0 11.9111 0C8.44444 0 5.68889 2.57778 5.15556 5.77778C5.42222 5.77778 5.68889 5.68889 6.04444 5.68889C6.4 5.68889 6.84444 5.77778 7.2 5.77778L7.2 5.77778C7.64444 3.55556 9.6 2 11.9111 2C13.8667 2 15.5556 3.11111 16.3556 4.8C16.3556 4.8 16.4444 4.88889 16.4444 4.8C17.0667 4.71111 17.7778 4.53333 18.4 4.53333C18.4 4.62222 18.4 4.62222 18.4 4.53333"
      fill="#006EFF"
    />
  </BaseSvg>
);
export const QuicCloudIcon: React.FC<IconProps> = ({
  color = "#66CCCA",
  ...props
}) => (
  <BaseSvg viewBox="-58 -13 100 65" fill="none" {...props}>
    <g>
      <path
        fill="#97A3AA"
        d="M13.705,11.807C11.18,8.489,7.516,6.351,3.383,5.79C2.682,5.699,1.968,5.648,1.263,5.648 c-2.549,0-4.992,0.609-7.263,1.807C-6.387,7.66-6.766,7.881-7.128,8.114l-0.017,0.009l-0.014,0.012l-1.259,0.946l-0.398,0.297 l0.3,0.398l3.249,4.273l0.301,0.391l0.394-0.297l0.972-0.739c0.181-0.111,0.373-0.223,0.571-0.328 c1.343-0.71,2.792-1.069,4.301-1.069c0.417,0,0.837,0.03,1.254,0.084c2.449,0.334,4.62,1.599,6.118,3.567 c1.499,1.962,2.141,4.394,1.809,6.844C9.83,27.07,5.89,30.514,1.288,30.514c-0.417,0-0.836-0.027-1.25-0.084 c-1.919-0.262-3.683-1.102-5.094-2.432c-0.153-0.146-0.307-0.301-0.463-0.465l-12.231-16.077l-0.778-1.027l-0.003,0.047 l-0.511-0.671l-0.151-0.183c-0.32-0.354-0.642-0.681-0.967-0.99c-2.476-2.336-5.574-3.814-8.958-4.276 c-0.725-0.098-1.466-0.146-2.196-0.146c-8.093,0-15.018,6.052-16.107,14.076c-0.582,4.299,0.547,8.573,3.181,12.032 c2.633,3.459,6.451,5.689,10.748,6.273c0.733,0.098,1.478,0.146,2.213,0.146c2.655,0,5.198-0.633,7.564-1.885 c0.091-0.045,0.173-0.094,0.262-0.145l0.098-0.054l0.498-0.28l-0.346-0.451l-3.301-4.336l-0.244-0.318l-0.358,0.166 c-1.333,0.626-2.746,0.943-4.199,0.943c-0.442,0-0.891-0.029-1.332-0.09c-5.413-0.736-9.22-5.739-8.486-11.151 c0.663-4.888,4.881-8.573,9.813-8.573c0.444,0,0.895,0.031,1.339,0.091c2.057,0.28,3.944,1.182,5.456,2.605 c0.167,0.16,0.334,0.328,0.496,0.505l9.613,12.633l0.776,1.02l0.006-0.051l3.131,4.118l0.146,0.178 c0.308,0.345,0.616,0.66,0.93,0.955c2.38,2.242,5.353,3.664,8.598,4.104c0.689,0.093,1.4,0.144,2.113,0.144 c7.765,0,14.408-5.813,15.456-13.511C17.31,19.228,16.229,15.125,13.705,11.807z"
      />
      <g>
        <path
          fill={color}
          d="M-12.902,33.371c-0.049-0.052-0.104-0.103-0.152-0.15l-6.202-8.149c-0.269-0.301-0.562-0.603-0.871-0.893 c-2.307-2.173-5.185-3.552-8.328-3.98c-0.298-0.036-0.6-0.067-0.898-0.088h-0.46l2.287,2.992c0.049,0.048,0.104,0.105,0.152,0.155 l6.202,8.145c0.27,0.301,0.562,0.606,0.872,0.896c2.306,2.173,5.185,3.549,8.326,3.974c0.303,0.038,0.603,0.069,0.901,0.092h0.458 L-12.902,33.371z"
        />
      </g>
    </g>
  </BaseSvg>
);
export const MeiliSearchIcon: React.FC<IconProps> = ({
  color = "currentColor",
  ...props
}) => (
  <BaseSvg
    viewBox="0 0 162 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M59.2069 14.2074C59.2069 12.5978 59.9786 11.6497 61.4559 11.6497C62.845 11.6497 63.308 12.6419 63.308 13.9208V20.7781H66.439V13.568C66.439 10.878 65.0279 8.9597 62.2497 8.9597C60.596 8.9597 59.4274 9.46683 58.4131 10.5913C57.7516 9.57708 56.6271 8.9597 55.0616 8.9597C53.4079 8.9597 52.2614 9.64323 51.7322 10.6354V9.22429H48.8438V20.7781H51.9747V14.1413C51.9747 12.5978 52.7685 11.6497 54.2238 11.6497C55.6129 11.6497 56.0759 12.6419 56.0759 13.9208V20.7781H59.2069V14.2074Z"
      fill={color}
    />
    <path
      d="M79.2905 15.9052C79.2905 15.9052 79.3346 15.4863 79.3346 14.9791C79.3346 11.5615 77.0194 8.9597 73.6018 8.9597C70.1841 8.9597 67.8028 11.5615 67.8028 14.9791C67.8028 18.5291 70.2062 21.0427 73.6238 21.0427C76.2918 21.0427 78.4085 19.4331 79.092 17.0959H75.939C75.5641 17.9337 74.6601 18.3527 73.712 18.3527C72.1465 18.3527 71.1322 17.4928 70.9117 15.9052H79.2905ZM73.5797 11.4733C75.035 11.4733 75.9831 12.3553 76.2036 13.6562H70.9558C71.2204 12.3332 72.1465 11.4733 73.5797 11.4733Z"
      fill={color}
    />
    <path
      d="M79.7962 11.9143H81.1853V20.7781H84.3163V9.22429H79.7962V11.9143ZM82.7508 7.72495C83.8533 7.72495 84.647 6.95322 84.647 5.85076C84.647 4.7483 83.8533 3.95453 82.7508 3.95453C81.6483 3.95453 80.8546 4.7483 80.8546 5.85076C80.8546 6.95322 81.6483 7.72495 82.7508 7.72495Z"
      fill={color}
    />
    <path
      d="M90.7996 18.0881C90.7114 18.0881 90.5791 18.1101 90.3807 18.1101C89.6751 18.1101 89.5869 17.7794 89.5869 17.2943V4.24117H86.4559V17.5148C86.4559 19.8079 87.3379 20.8222 89.8295 20.8222C90.2484 20.8222 90.6453 20.7781 90.7996 20.756V18.0881Z"
      fill={color}
    />
    <path
      d="M91.1559 11.9143H92.545V20.7781H95.676V9.22429H91.1559V11.9143ZM94.1105 7.72495C95.2129 7.72495 96.0067 6.95322 96.0067 5.85076C96.0067 4.7483 95.2129 3.95453 94.1105 3.95453C93.008 3.95453 92.2142 4.7483 92.2142 5.85076C92.2142 6.95322 93.008 7.72495 94.1105 7.72495Z"
      fill={color}
    />
    <path
      d="M101.96 20.899C105.003 20.899 106.436 19.2894 106.436 17.5916C106.436 12.8731 99.4908 15.4969 99.4908 12.388C99.4908 11.3737 100.351 10.5138 102.093 10.5138C103.879 10.5138 104.716 11.484 104.849 12.6967H106.414C106.282 11.1753 105.246 9.14675 102.137 9.14675C99.4688 9.14675 97.9694 10.7343 97.9694 12.4541C97.9694 17.0624 104.915 14.4165 104.915 17.6357C104.915 18.7602 103.857 19.5319 101.96 19.5319C100.02 19.5319 99.0498 18.5618 98.9396 17.1286H97.3521C97.4843 19.0909 98.7191 20.899 101.96 20.899Z"
      fill={color}
    />
    <path
      d="M118.87 15.4749C118.87 15.4749 118.892 15.1221 118.892 14.8795C118.892 11.7045 116.842 9.14675 113.49 9.14675C110.116 9.14675 107.978 11.9029 107.978 15.0118C107.978 18.1649 109.962 20.899 113.512 20.899C116.18 20.899 118.032 19.2673 118.694 17.1286H117.062C116.577 18.4956 115.254 19.4878 113.534 19.4878C111.175 19.4878 109.698 17.7459 109.543 15.4749H118.87ZM113.49 10.5579C115.695 10.5579 117.128 12.0352 117.327 14.196H109.587C109.852 12.1234 111.307 10.5579 113.49 10.5579Z"
      fill={color}
    />
    <path
      d="M128.611 15.2985V16.3568C128.611 18.2751 127.222 19.5981 124.554 19.5981C122.9 19.5981 121.996 18.9146 121.996 17.4373C121.996 16.6876 122.349 16.1143 122.9 15.8056C123.473 15.4969 124.245 15.2985 128.611 15.2985ZM124.377 20.899C126.318 20.899 127.883 20.2816 128.677 19.0027V20.6344H130.176V13.292C130.176 10.8004 128.743 9.14675 125.502 9.14675C122.393 9.14675 121.026 10.7122 120.739 12.7187H122.261C122.569 11.1312 123.782 10.4917 125.436 10.4917C127.552 10.4917 128.611 11.3737 128.611 13.2699V13.9976C125.061 13.9976 123.584 14.0637 122.481 14.5047C121.202 15.0118 120.453 16.1364 120.453 17.4814C120.453 19.4437 121.709 20.899 124.377 20.899Z"
      fill={color}
    />
    <path
      d="M138.735 9.32314C138.735 9.32314 138.471 9.30109 138.36 9.30109C136.288 9.30109 135.185 10.3815 134.766 11.1532V9.41134H133.267V20.6344H134.832V14.2622C134.832 11.9249 136.266 10.7784 138.184 10.7784C138.471 10.7784 138.735 10.8004 138.735 10.8004V9.32314Z"
      fill={color}
    />
    <path
      d="M139.003 15.0339C139.003 18.0987 141.119 20.899 144.537 20.899C147.58 20.899 149.344 18.8705 149.785 16.6435H148.197C147.734 18.3854 146.455 19.4878 144.537 19.4878C142.178 19.4878 140.59 17.6136 140.59 15.0339C140.59 12.4321 142.178 10.5579 144.537 10.5579C146.455 10.5579 147.734 11.6604 148.197 13.4022H149.785C149.344 11.1753 147.58 9.14675 144.537 9.14675C141.119 9.14675 139.003 11.947 139.003 15.0339Z"
      fill={color}
    />
    <path
      d="M153.47 4.09747H151.905V20.6344H153.47V13.9976C153.47 11.7045 154.947 10.5138 156.844 10.5138C158.85 10.5138 159.798 11.7486 159.798 13.7771V20.6344H161.364V13.4684C161.364 10.9768 159.886 9.14675 157.108 9.14675C155.014 9.14675 153.867 10.2933 153.47 10.9768V4.09747Z"
      fill={color}
    />
    <path
      d="M0 24.4968L7.60256 5.04523C8.67392 2.30411 11.3161 0.5 14.2591 0.5H18.8426L11.24 19.9516C10.1687 22.6927 7.52653 24.4968 4.58348 24.4968H0Z"
      fill="url(#paint0_linear_2735_3490)"
    />
    <path
      d="M11.1533 24.4969L18.7558 5.04529C19.8272 2.30417 22.4693 0.500057 25.4124 0.500057H29.9959L22.3933 19.9517C21.3219 22.6928 18.6798 24.4969 15.7368 24.4969H11.1533Z"
      fill="url(#paint1_linear_2735_3490)"
    />
    <path
      d="M22.3072 24.4969L29.9098 5.04529C30.9811 2.30417 33.6233 0.500057 36.5663 0.500057H41.1498L33.5472 19.9517C32.4759 22.6928 29.8337 24.4969 26.8907 24.4969H22.3072Z"
      fill="url(#paint2_linear_2735_3490)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_2735_3490"
        x1="41.1499"
        y1="-1.33294"
        x2="-1.49296e-06"
        y2="21.9145"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FF5CAA" />
        <stop offset="1" stopColor="#FF4E62" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_2735_3490"
        x1="41.1499"
        y1="-1.33294"
        x2="-1.49296e-06"
        y2="21.9145"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FF5CAA" />
        <stop offset="1" stopColor="#FF4E62" />
      </linearGradient>
      <linearGradient
        id="paint2_linear_2735_3490"
        x1="41.1499"
        y1="-1.33294"
        x2="-1.49296e-06"
        y2="21.9145"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FF5CAA" />
        <stop offset="1" stopColor="#FF4E62" />
      </linearGradient>
    </defs>
  </BaseSvg>
);

export const LiteSpeedIcon: React.FC<IconProps> = ({
  color = "#003366",
  ...props
}) => (
  <BaseSvg
    viewBox="0 0 250 60"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fill={color}
      d="M52.013,22.19l-3.08,3.08l3.095-3.093C52.024,22.179,52.021,22.182,52.013,22.19z"
    />
    <polygon fill={color} points="46.823,27.38 46.823,27.38 48.933,25.271" />
    <path
      fill={color}
      d="M48.215,29.117L34.938,15.841l-5.656,7.178l6.099,6.098c0.562,0.563,0.562,1.483,0,2.045l-1.765,1.765
      c0,0,1.189,1.779,1.244,1.888c0.274,0.55,0.34,1.841-0.438,2.432L20.552,47.893c-0.003,3.572-0.007,10.92-0.002,10.923
      c0.003,0.001,27.665-27.653,27.665-27.653C48.778,30.599,48.778,29.681,48.215,29.117z"
    />
    <path
      fill="#093071"
      d="M17.375,30.789c-0.562-0.562-0.562-1.479,0-2.043l1.766-1.766l-1.207-1.735
      c-0.576-0.816-0.396-1.975,0.399-2.582l13.871-10.648L32.214,1.1l-0.009-0.006l-0.007-0.01L4.539,28.746
      c-0.563,0.564-0.563,1.481,0.001,2.045l13.276,13.276l5.657-7.181L17.375,30.789z"
    />
    <polygon
      fill="#FFFFFF"
      points="26.611,39.554 26.611,39.554 20.192,45.973"
    />
    <path
      fill={color}
      d="M39.195,7.751c0.185,0,0.371,0.117,0.453,0.282c0.146,0.302-0.046,0.585-0.239,0.828L27.254,24.289
      c-0.175,0.224-0.188,0.655-0.028,0.888c0,0,6.561,9.514,6.787,9.84c0.249,0.359,0.266,1.422-0.305,1.854L14.166,51.873
      c-0.278,0.214-0.436,0.283-0.629,0.285c-0.175-0.012-0.356-0.131-0.431-0.281c-0.146-0.298,0.047-0.587,0.238-0.833
      l12.153-15.425c0.176-0.232,0.191-0.646,0.029-0.888l-6.783-9.757c-0.431-0.612-0.297-1.481,0.299-1.937L38.589,8.033
      C38.906,7.786,39.067,7.751,39.195,7.751"
    />
    <path
      fill="#F5CD21"
      d="M33.517,35.054c0.158,0.239,0.299,1.14-0.096,1.44L13.875,51.496c-0.164,0.128-0.27,0.188-0.316,0.185
      c-0.067,0.004-0.019-0.115,0.161-0.346l12.149-15.419c0.307-0.396,0.327-1.048,0.045-1.455l-6.781-9.759
      C19.133,24.702,33.359,34.814,33.517,35.054z"
    />
    <path
      fill="#FDDD75"
      d="M33.517,35.054l-6.679-9.607c-0.283-0.408-0.26-1.061,0.044-1.449l12.15-15.425
      c0.181-0.23,0.228-0.346,0.163-0.346c-0.049,0-0.156,0.057-0.317,0.185L19.332,23.415c-0.393,0.301-0.484,0.883-0.199,1.288
      L33.517,35.054z"
    />
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
export const CreativeCommonsIcon = createSimpleIcon("creativecommons");
export const ZhihuIcon = createSimpleIcon("zhihu", "#0084FF");

// --- Mingcute Icons ---
// @keep-sorted
export const BilibiliIcon = createMingcuteIcon("bilibili-line", "#00A1D6");
export const GoogleIcon = createMingcuteIcon("google-fill", "#4285F4");
export const QQIcon = createMingcuteIcon("qq-fill", "#12B7F5");
export const WechatIcon = createMingcuteIcon("wechat-fill", "#07C160");
