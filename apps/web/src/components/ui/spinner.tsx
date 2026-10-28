import type { ComponentProps } from "react";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

/** 加载指示沿用项目图标集；减少动态效果时停转，仅保留静态图形。 */
function Spinner({ className, ...props }: Omit<ComponentProps<"svg">, "ref">) {
  return (
    <Icon
      icon="mingcute:loading-3-line"
      role="status"
      aria-label="加载中"
      className={cn("size-4 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Spinner };
