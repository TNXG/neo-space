"use client";

import type { UseFormRegister } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import Home3Line from "~icons/mingcute/home-3-line";

import LinkLine from "~icons/mingcute/link-line";
import PicLine from "~icons/mingcute/pic-line";

import { Field, FieldContent, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

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
          <Home3Line className="w-3.5 h-3.5" />
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
          <LinkLine className="w-3.5 h-3.5" />
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
          <PicLine className="w-3.5 h-3.5" />
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
