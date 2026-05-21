/**
 * InlineIcon — 直接从预提取的静态数据渲染 SVG，零运行时 JSON 加载。
 *
 * 用法与 @iconify/react 完全一致：
 *   import { Icon } from "@/lib/inline-icon";
 *   <Icon icon="mingcute:arrow-right-line" className="w-4 h-4" />
 *
 * 支持的集合：mingcute · simple-icons · catppuccin
 * 图标数据由 scripts/extract-icons.ts 自动从源码扫描生成（src/lib/icon-data.ts）。
 * 新增图标后重新运行 `pnpm icons:extract` 即可。
 */

import type { SVGProps } from "react";
import { allIconCollections } from "./icon-data";

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** "collection:icon-name" 格式，如 "mingcute:arrow-right-line" */
  icon: string;
  width?: number | string;
  height?: number | string;
}

export const Icon: React.FC<IconProps> = ({
  icon,
  width = "1em",
  height = "1em",
  className,
  style,
  ...rest
}) => {
  const colonIdx = icon.indexOf(":");
  if (colonIdx === -1)
    return null;

  const collection = icon.slice(0, colonIdx);
  const name = icon.slice(colonIdx + 1);
  const data = allIconCollections[collection]?.[name];

  if (!data)
    return null;

  return (

    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={data.viewBox}
      width={width}
      height={height}
      className={className}
      style={{ display: "block", flexShrink: 0, ...style }}
      // eslint-disable-next-line react-dom/no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: data.body }}
      {...rest}
    />
  );
};
