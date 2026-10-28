"use client";

import { useState } from "react";
import { toast } from "sonner";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Icon } from "@/lib/inline-icon";

interface SecretInputProps {
  id?: string;
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

/** 凭据输入：默认遮挡，可临时显示；不让浏览器记住或自动填充。 */
export function SecretInput({ id, value, disabled, invalid, describedBy, placeholder, onChange }: SecretInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <InputGroup data-disabled={disabled}>
      <InputGroupInput
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        placeholder={placeholder ?? (value ? undefined : "未设置")}
        autoComplete="new-password"
        spellCheck={false}
        className="font-mono"
        onChange={event => onChange(event.target.value)}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label={visible ? "隐藏内容" : "显示内容"} aria-pressed={visible} onClick={() => setVisible(current => !current)}>
          <Icon icon={visible ? "mingcute:eye-close-line" : "mingcute:eye-line"} aria-hidden="true" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

/** 只读值附带复制按钮，用于需要粘贴到第三方后台的地址。 */
export function CopyField({ id, value, label }: { id?: string; value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`已复制${label}`);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("无法访问剪贴板，请手动选择复制");
    }
  }

  return (
    <InputGroup>
      <InputGroupInput id={id} readOnly value={value} className="font-mono text-[0.8125rem]" onFocus={event => event.currentTarget.select()} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label={`复制${label}`} onClick={() => { void copy(); }}>
          <Icon icon={copied ? "mingcute:check-line" : "mingcute:copy-2-line"} aria-hidden="true" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}
