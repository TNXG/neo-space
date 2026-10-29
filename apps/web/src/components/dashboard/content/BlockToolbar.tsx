"use client";

import type { BlockFormat, EditorCommands, FormatState } from "@neo-space/editor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { ToolbarButton } from "./FloatingToolbar";

const BLOCK_OPTIONS: { value: BlockFormat; label: string; icon: string; className?: string }[] = [
  { value: "paragraph", label: "正文", icon: "mingcute:paragraph-line" },
  { value: "h1", label: "一级标题", icon: "mingcute:heading-1-line", className: "text-base font-bold" },
  { value: "h2", label: "二级标题", icon: "mingcute:heading-2-line", className: "text-[0.9375rem] font-semibold" },
  { value: "h3", label: "三级标题", icon: "mingcute:heading-3-line", className: "font-semibold" },
  { value: "h4", label: "四级标题", icon: "mingcute:heading-3-line", className: "font-medium" },
  { value: "blockquote", label: "引用", icon: "mingcute:quote-left-line" },
  { value: "code_block", label: "代码块", icon: "mingcute:code-line" },
];

interface BlockToolbarProps {
  commands?: EditorCommands;
  format?: FormatState;
  onPickImage: () => void;
  uploading: boolean;
}

/**
 * 编辑区顶部工具栏：段落样式、列表与常用插入；选中文字的格式交给浮动工具栏，二者职责不重叠。
 * @param props 命令与格式状态
 * @returns 工具栏
 */
export function BlockToolbar({ commands, format, onPickImage, uploading }: BlockToolbarProps) {
  const block = format?.block ?? "paragraph";
  const current = BLOCK_OPTIONS.find(option => option.value === block) ?? BLOCK_OPTIONS[0];
  const disabled = !commands;

  return (
    <div role="toolbar" aria-label="段落与插入" className={cn("-mx-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", disabled && "pointer-events-none opacity-50")}>
      <ToolbarButton label="撤销（Ctrl Z）" icon="mingcute:corner-up-left-line" onPress={() => commands?.undo()} />
      <ToolbarButton label="重做（Ctrl Shift Z）" icon="mingcute:corner-up-right-line" onPress={() => commands?.redo()} />
      <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={`段落样式：${current.label}`} className="flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-foreground/80 outline-none transition-colors duration-(--motion-duration-fast) hover:bg-foreground/6 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-foreground/6">
            <Icon icon={current.icon} className="size-4" aria-hidden="true" />
            <span className="hidden w-14 truncate text-left sm:inline">{["bullet_list", "ordered_list", "task_list"].includes(block) ? "列表" : current.label}</span>
            <Icon icon="mingcute:down-line" className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} onCloseAutoFocus={event => { event.preventDefault(); commands?.focus(); }} className="min-w-44">
          <DropdownMenuGroup>
            {BLOCK_OPTIONS.map(option => (
              <DropdownMenuItem key={option.value} onSelect={() => commands?.setBlock(option.value)} className={cn(option.className, option.value === block && "text-primary")}>
                <Icon icon={option.icon} aria-hidden="true" />
                {option.label}
                {option.value === block && <Icon icon="mingcute:check-line" className="ml-auto" aria-hidden="true" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton label="无序列表" icon="mingcute:list-check-line" active={block === "bullet_list"} onPress={() => commands?.setBlock("bullet_list")} />
      <ToolbarButton label="有序列表" icon="mingcute:list-ordered-line" active={block === "ordered_list"} onPress={() => commands?.setBlock("ordered_list")} />
      <ToolbarButton label="任务列表" icon="mingcute:check-circle-line" active={block === "task_list"} onPress={() => commands?.setBlock("task_list")} />
      <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden="true" />
      <ToolbarButton label={uploading ? "图片上传中" : "插入图片（也可直接粘贴或拖入）"} icon={uploading ? "mingcute:loading-line" : "mingcute:pic-line"} onPress={onPickImage} />
      <ToolbarButton label="插入表格" icon="mingcute:table-2-line" onPress={() => commands?.insertTable()} />
      <ToolbarButton label="插入公式" icon="mingcute:formula-line" onPress={() => commands?.insertMath()} />
      <ToolbarButton label="插入横幅" icon="mingcute:information-line" onPress={() => commands?.insertContainer("info", "")} />
      <ToolbarButton label="分隔线" icon="mingcute:minimize-line" onPress={() => commands?.insertDivider()} />
    </div>
  );
}
