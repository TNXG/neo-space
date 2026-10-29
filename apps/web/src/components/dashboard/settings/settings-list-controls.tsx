"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/inline-icon";

interface CommonListProps {
  id: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  itemLabel?: string;
}

/** 关键词以可删除标签呈现，Enter 或按钮添加，连续输入保持焦点。 */
export function SettingsTags({ id, value, onChange, disabled, invalid, describedBy, placeholder, itemLabel = "条目" }: CommonListProps & {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [text, setText] = useState("");
  const [duplicate, setDuplicate] = useState("");
  const input = useRef<HTMLInputElement>(null);

  /** 空白忽略，重复项只提示而不修改已有值。 */
  function add() {
    const next = text.trim();
    if (!next || disabled) return;
    if (value.some(item => item.toLowerCase() === next.toLowerCase())) {
      setDuplicate(`${itemLabel}已存在。`);
      return;
    }
    onChange([...value, next]);
    setText("");
    setDuplicate("");
    input.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    add();
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          ref={input}
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          placeholder={placeholder ?? `输入${itemLabel}后按 Enter`}
          spellCheck={false}
          onChange={event => { setText(event.target.value); setDuplicate(""); }}
          onKeyDown={handleKeyDown}
        />
        <Button type="button" variant="secondary" size="sm" disabled={disabled || !text.trim()} onClick={add}>
          <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />添加
        </Button>
      </div>
      {duplicate && <p role="status" className="text-xs text-muted-foreground">{duplicate}</p>}
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">尚未添加{itemLabel}。</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label={`已添加的${itemLabel}`}>
          {value.map((item, index) => (
            <li key={`${item}-${index}`}>
              <Badge variant="secondary" className="gap-1 py-1 pr-1 text-sm font-normal">
                <span className="max-w-64 truncate">{item}</span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`移除${itemLabel}${item}`}
                  className="cursor-pointer rounded-full p-0.5 hover:bg-background/60 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                >
                  <Icon icon="mingcute:close-line" className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 逐条列表保留每项独立输入与删除按钮；空白新增行不写入配置。 */
export function SettingsList({ id, value, onChange, disabled, invalid, describedBy, placeholder, itemLabel = "条目" }: CommonListProps & {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [blank, setBlank] = useState(false);
  const [draft, setDraft] = useState("");
  const pending = useRef<HTMLInputElement>(null);
  const describedById = describedBy ? `${describedBy} ${id}-list-hint` : `${id}-list-hint`;

  useEffect(() => {
    if (blank) pending.current?.focus();
  }, [blank]);

  /** 非空输入才追加；空行视为取消。 */
  function commit() {
    const next = draft.trim();
    if (next) onChange([...value, next]);
    setDraft("");
    setBlank(false);
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ul className="flex flex-col gap-2" aria-label={`${itemLabel}列表`}>
        {value.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              aria-label={`${itemLabel}${index + 1}`}
              aria-invalid={invalid}
              aria-describedby={describedById}
              value={item}
              disabled={disabled}
              spellCheck={false}
              onChange={event => onChange(value.map((current, itemIndex) => itemIndex === index ? event.target.value : current))}
            />
            <Button type="button" variant="ghost" size="icon-sm" disabled={disabled} aria-label={`移除${itemLabel}${index + 1}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>
              <Icon icon="mingcute:delete-line" aria-hidden="true" />
            </Button>
          </li>
        ))}
        {blank && (
          <li className="flex items-center gap-2">
            <Input
              ref={pending}
              aria-label={`添加${itemLabel}`}
              value={draft}
              disabled={disabled}
              placeholder={placeholder ?? `输入${itemLabel}`}
              spellCheck={false}
              onChange={event => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={event => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); commit(); }
                if (event.key === "Escape") { setDraft(""); setBlank(false); }
              }}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="取消添加" onClick={() => { setDraft(""); setBlank(false); }}>
              <Icon icon="mingcute:close-line" aria-hidden="true" />
            </Button>
          </li>
        )}
      </ul>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={disabled || blank} onClick={() => setBlank(true)}>
          <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden="true" />添加{itemLabel}
        </Button>
        <p id={`${id}-list-hint`} className="text-xs text-muted-foreground">每条记录单独保存；空白条目无法提交。</p>
      </div>
    </div>
  );
}
