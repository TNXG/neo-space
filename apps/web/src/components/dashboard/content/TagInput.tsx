"use client";

import type { TagSummary } from "@/types/api";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/inline-icon";

interface TagInputProps {
  id: string;
  value: string[];
  suggestions: TagSummary[];
  onChange: (tags: string[]) => void;
}

/**
 * 标签输入：回车或逗号确认，退格删除最后一个；已有标签按使用次数给出补全。
 * @param props 当前标签、候选与修改回调
 * @returns 标签输入框
 */
export function TagInput({ id, value, suggestions, onChange }: TagInputProps) {
  const [text, setText] = useState("");
  const query = text.trim().toLowerCase();
  const matches = query
    ? suggestions.filter(tag => tag.name.toLowerCase().includes(query) && !value.includes(tag.name)).slice(0, 6)
    : [];

  const add = (raw: string) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setText("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex min-h-9 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-1.5 py-1 transition-[border-color,box-shadow] duration-(--motion-duration-press) focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button type="button" aria-label={`移除标签 ${tag}`} onClick={() => onChange(value.filter(item => item !== tag))} className="flex size-4 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground">
              <Icon icon="mingcute:close-line" className="size-3" aria-hidden="true" />
            </button>
          </Badge>
        ))}
        <input
          id={id}
          value={text}
          onChange={event => setText(event.target.value.replace(/[,，]/g, ""))}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Enter" || event.key === "," || event.key === "，") {
              event.preventDefault();
              add(matches[0] && event.key === "Enter" && matches[0].name.toLowerCase() === query ? matches[0].name : text);
            } else if (event.key === "Backspace" && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text && add(text)}
          placeholder={value.length ? "" : "输入后回车添加"}
          className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {matches.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label="已有标签">
          {matches.map(tag => (
            <button key={tag.name} type="button" onMouseDown={event => event.preventDefault()} onClick={() => add(tag.name)} className="cursor-pointer rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">
              {tag.name}<span className="ml-1 tabular-nums opacity-60">{tag.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
