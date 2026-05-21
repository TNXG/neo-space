"use client";

import type { UseFormRegister } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import { useTranslations } from "next-intl";

import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/lib/inline-icon";

interface BasicInfoStepProps {
  register: UseFormRegister<LinkApplyFormData>;
  errors: {
    name?: string;
    url?: string;
    avatar?: string;
  };
}

export function BasicInfoStep({ register, errors }: BasicInfoStepProps) {
  const t = useTranslations();

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>
          <Icon icon="mingcute:home-3-line" className="w-3.5 h-3.5" />
          {t("friends.apply.basic.siteName")}
        </FieldLabel>
        <FieldContent>
          <input
            {...register("name")}
            type="text"
            placeholder={t("friends.apply.basic.siteNamePlaceholder")}
            className="form-input"
            autoFocus
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:link-line" className="w-3.5 h-3.5" />
          {t("friends.apply.basic.siteUrl")}
        </FieldLabel>
        <FieldContent>
          <input
            {...register("url")}
            type="url"
            placeholder="https://example.com"
            className="form-input"
          />
          {errors.url && <FieldError>{errors.url}</FieldError>}
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:pic-line" className="w-3.5 h-3.5" />
          {t("friends.apply.basic.avatarUrl")}
        </FieldLabel>
        <FieldContent>
          <input
            {...register("avatar")}
            type="url"
            placeholder="https://example.com/avatar.png"
            className="form-input"
          />
          {errors.avatar && <FieldError>{errors.avatar}</FieldError>}
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
