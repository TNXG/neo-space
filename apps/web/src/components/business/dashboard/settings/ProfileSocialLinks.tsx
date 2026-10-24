"use client";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Icon } from "@/lib/inline-icon";
import { socialFields, type ProfileDraft, type SocialProfileField } from "./profile-settings-model";

interface ProfileSocialLinksProps {
  draft: ProfileDraft;
  disabled: boolean;
  onEntriesChange: (keys: SocialProfileField[], values: Record<SocialProfileField, string>) => void;
}

/** Edit a compact, duplicate-free list while leaving untouched API social fields intact. */
export function ProfileSocialLinks({ draft, disabled, onEntriesChange }: ProfileSocialLinksProps) {
  const { social, socialKeys } = draft;
  const available = socialFields.find(({ key }) => !socialKeys.includes(key));

  /** Add the first unused platform without turning an empty row into an API change. */
  function addEntry() {
    if (disabled || !available) return;
    onEntriesChange([...socialKeys, available.key], { ...social, [available.key]: "" });
  }

  /** Carry the row's value to an unused platform and explicitly clear its old platform. */
  function changePlatform(oldKey: SocialProfileField, value: string) {
    const nextKey = socialFields.find(({ key }) => key === value)?.key;
    if (disabled || !nextKey || oldKey === nextKey || socialKeys.includes(nextKey)) return;
    onEntriesChange(
      socialKeys.map((key) => key === oldKey ? nextKey : key),
      { ...social, [oldKey]: "", [nextKey]: social[oldKey] },
    );
  }

  /** Remove a visible row and retain an explicit cleared value for replacement payloads. */
  function removeEntry(key: SocialProfileField) {
    if (disabled) return;
    onEntriesChange(socialKeys.filter((entry) => entry !== key), { ...social, [key]: "" });
  }

  /** Update one visible account without altering the other social values or row order. */
  function changeValue(key: SocialProfileField, value: string) {
    if (disabled) return;
    onEntriesChange(socialKeys, { ...social, [key]: value });
  }

  return (
    <FieldSet disabled={disabled} className="gap-0">
      <FieldLegend className="mb-4 w-full">
        <span className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-3 text-sm font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Icon icon="mingcute:link-line" aria-hidden /></span>
            社交链接
          </span>
          <Button type="button" variant="secondary" size="sm" disabled={disabled || !available} onClick={addEntry}>
            <Icon icon="mingcute:add-line" data-icon="inline-start" aria-hidden />
            添加
          </Button>
        </span>
      </FieldLegend>
      {socialKeys.length === 0 ? (
        <FieldDescription className="py-8 text-center">暂未添加任何社交链接</FieldDescription>
      ) : (
        <FieldGroup className="gap-0 divide-y divide-border/50 border-y border-border/60">
          {socialKeys.map((key) => {
            const field = socialFields.find((entry) => entry.key === key)!;
            const inputId = `profile-social-${key}`;
            const descriptionId = `${inputId}-description`;
            return (
              <Field
                key={key}
                data-disabled={disabled}
                className="grid grid-cols-[6rem_minmax(0,1fr)_2rem] items-center gap-x-2 gap-y-1.5 px-4 py-4 lg:grid-cols-[9rem_minmax(0,1fr)_2rem] lg:gap-x-3"
              >
                <select
                  aria-label={`${field.label}的平台`}
                  value={key}
                  disabled={disabled}
                  className="h-9 min-w-0 cursor-pointer rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                  onChange={(event) => changePlatform(key, event.target.value)}
                >
                  {socialFields.map((platform) => (
                    <option key={platform.key} value={platform.key} disabled={platform.key !== key && socialKeys.includes(platform.key)}>
                      {platform.label}
                    </option>
                  ))}
                </select>
                <Input
                  id={inputId}
                  aria-label={`${field.label}链接或 ID`}
                  aria-describedby={descriptionId}
                  value={social[key]}
                  type={field.type}
                  placeholder="输入链接或 ID…"
                  spellCheck={false}
                  autoComplete="off"
                  disabled={disabled}
                  onChange={(event) => changeValue(key, event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`移除${field.label}`}
                  disabled={disabled}
                  onClick={() => removeEntry(key)}
                >
                  <Icon icon="mingcute:delete-line" aria-hidden />
                </Button>
                <FieldDescription id={descriptionId} className="col-start-2 col-end-3">
                  {field.description}
                </FieldDescription>
              </Field>
            );
          })}
        </FieldGroup>
      )}
    </FieldSet>
  );
}
