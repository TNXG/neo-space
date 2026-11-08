"use client";

import type { GroupProps, PanelProps, SeparatorProps } from "react-resizable-panels";
import * as ResizablePrimitive from "react-resizable-panels";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";

/** 可键盘调整的分栏容器；方向由 `orientation` 决定。 */
function ResizablePanelGroup({ className, ...props }: GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn("flex h-full w-full aria-[orientation=vertical]:flex-col", className)}
      {...props}
    />
  );
}

function ResizablePanel(props: PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

/** 分隔条扩大点击热区，聚焦时显示环，手柄图标随方向旋转。 */
function ResizableHandle({ withHandle, className, ...props }: SeparatorProps & { withHandle?: boolean }) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className,
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-border bg-background">
          <Icon icon="mingcute:more-2-line" className="size-2.5 text-muted-foreground" aria-hidden="true" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
