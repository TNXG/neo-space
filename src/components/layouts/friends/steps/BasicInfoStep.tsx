"use client";

import type { UseFormRegister } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";

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
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>
          <Icon icon="mingcute:home-3-line" className="w-3.5 h-3.5" />
          站点名称
        </FieldLabel>
        <FieldContent>
          <input
            {...register("name")}
            type="text"
            placeholder="我的博客"
            className="form-input"
            autoFocus
          />
          {errors.name && <FieldError>{errors.name}</FieldError>}
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:link-line" className="w-3.5 h-3.5" />
          站点地址
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
          头像地址
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
