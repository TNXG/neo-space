import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

/**
 * ButtonGroup 变体配置
 * - 胶囊形圆角 (rounded-xl)
 * - Glassmorphism 边框风格
 */
const buttonGroupVariants = cva(
  [
    "flex w-fit items-stretch",
    // 子元素 focus 层级
    "[&>*]:focus-visible:z-10 [&>*]:focus-visible:relative",
    // Select 触发器宽度
    "[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit",
    // Input 弹性
    "[&>input]:flex-1",
    // 嵌套 ButtonGroup 间距
    "has-[>[data-slot=button-group]]:gap-2",
    // Glassmorphism 容器
    "bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/50 p-1",
  ].join(" "),
  {
    variants: {
      orientation: {
        horizontal: [
          // 子按钮圆角处理 - 保持内部按钮的圆角
          "[&>[data-slot=button]]:rounded-lg",
        ].join(" "),
        vertical: [
          "flex-col",
          "[&>[data-slot=button]]:rounded-lg",
        ].join(" "),
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  }
);

/**
 * 按钮组容器
 */
function ButtonGroup({
  className,
  orientation,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

/**
 * 按钮组文本标签
 */
function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : "div";

  return (
    <Comp
      className={cn(
        "flex items-center gap-2 px-4 text-sm font-medium text-muted-foreground",
        "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * 按钮组分隔线
 */
function ButtonGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        "relative m-0! self-stretch bg-border/30",
        "data-[orientation=vertical]:h-auto data-[orientation=vertical]:mx-1",
        "data-[orientation=horizontal]:my-1",
        className
      )}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
};
