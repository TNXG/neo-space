"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup } from "@/components/ui/field";
import { Icon } from "@/lib/inline-icon";

interface GuidelinesStepProps {
  register: UseFormRegister<LinkApplyFormData>;
  setValue: UseFormSetValue<LinkApplyFormData>;
  checked: boolean;
  error?: string;
}

export function GuidelinesStep({ register, setValue, checked, error }: GuidelinesStepProps) {
  const t = useTranslations();

  return (
    <FieldGroup>
      <div className="p-6 bg-accent-50/50 border border-accent-100 rounded-2xl">
        <div className="flex items-start gap-3 mb-4">
          <Icon icon="mingcute:information-line" className="w-6 h-6 text-accent-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-base font-bold text-accent-900 mb-2">{t("friends.apply.guidelines.title")}</h3>
            <p className="text-sm text-accent-800 leading-relaxed">
              {t("friends.apply.guidelines.readOur")}
              {" "}
              <Link href="/about-site#%E5%85%AB%E3%80%81%E5%8F%8B%E9%93%BE%E7%94%B3%E8%AF%B7%E6%9D%A1%E6%AC%BE" target="_blank" className="underline underline-offset-4 hover:text-accent-600 transition-colors font-medium">
                {t("friends.apply.guidelines.linkText")}
              </Link>
              {t("friends.apply.guidelines.trailing")}
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
            {t("friends.apply.guidelines.agreement")}
          </label>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </FieldGroup>
  );
}
