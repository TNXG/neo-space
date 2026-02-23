"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import { Icon } from "@iconify/react/offline";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";

interface GuidelinesStepProps {
  register: UseFormRegister<LinkApplyFormData>;
  setValue: UseFormSetValue<LinkApplyFormData>;
  checked: boolean;
  error?: string;
}

export function GuidelinesStep({ register, setValue, checked, error }: GuidelinesStepProps) {
  return (
    <FieldGroup>
      <div className="p-6 bg-accent-50/50 border border-accent-100 rounded-2xl">
        <div className="flex items-start gap-3 mb-4">
          <Icon icon="mingcute:information-line" className="w-6 h-6 text-accent-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-accent-900 mb-2">在提交友链之前</h3>
            <p className="text-sm text-accent-800 leading-relaxed">
              请阅读我们的
              {" "}
              <Link href="/about-site#%E5%8F%8B%E9%93%BE%E7%94%B3%E8%AF%B7%E6%9D%A1%E6%AC%BE" target="_blank" className="underline underline-offset-4 hover:text-accent-600 transition-colors font-medium">
                友链指南
              </Link>
              。
            </p>
          </div>
        </div>
      </div>

      <Field>
        <div className="flex items-start gap-3">
          <Checkbox
            id="agree-guidelines"
            {...register("agreedToGuidelines")}
            checked={checked}
            onCheckedChange={checked => setValue("agreedToGuidelines", checked === true)}
          />
          <label htmlFor="agree-guidelines" className="text-sm leading-relaxed text-foreground">
            勾选此框，即表示您同意我们的友链指南和服务条款
          </label>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </FieldGroup>
  );
}
