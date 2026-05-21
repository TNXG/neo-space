"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/lib/inline-icon";

interface DetailsStepProps {
  register: UseFormRegister<LinkApplyFormData>;
  setValue: UseFormSetValue<LinkApplyFormData>;
  techstack: string[];
  techInput: string;
  onTechInputChange: (value: string) => void;
  onAddTech: () => void;
  onRemoveTech: (tech: string) => void;
  errors: {
    description?: string;
    rssurl?: string;
    techstack?: string;
  };
}

export function DetailsStep({
  register,
  techstack,
  techInput,
  onTechInputChange,
  onAddTech,
  onRemoveTech,
  errors,
}: DetailsStepProps) {
  const t = useTranslations();

  return (
    <FieldGroup>
      <Field>
        <FieldLabel>
          <Icon icon="mingcute:text-line" className="w-3.5 h-3.5" />
          {t("friends.apply.details.siteDescription")}
        </FieldLabel>
        <FieldContent>
          <textarea
            {...register("description")}
            placeholder={t("friends.apply.details.siteDescriptionPlaceholder")}
            className="form-input min-h-25 resize-none"
            autoFocus
          />
          {errors.description && <FieldError>{errors.description}</FieldError>}
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:rss-line" className="w-3.5 h-3.5" />
          {t("friends.apply.details.rssUrl")}
        </FieldLabel>
        <FieldContent>
          <input
            {...register("rssurl")}
            type="url"
            placeholder="https://example.com/feed.xml"
            className="form-input"
          />
          {errors.rssurl && <FieldError>{errors.rssurl}</FieldError>}
          <FieldDescription>{t("friends.apply.details.rssDescription")}</FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:code-line" className="w-3.5 h-3.5" />
          {t("friends.apply.details.techStack")}
        </FieldLabel>
        <FieldContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={techInput}
              onChange={e => onTechInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddTech();
                }
              }}
              placeholder={t("friends.apply.details.techStackPlaceholder")}
              className="form-input flex-1"
            />
            <Button type="button" variant="secondary" size="sm" onClick={onAddTech}>
              {t("friends.apply.details.addTech")}
            </Button>
          </div>
          {techstack.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              <AnimatePresence>
                {techstack.map(tech => (
                  <motion.span
                    key={tech}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent-50 text-accent-700 rounded-lg border border-accent-200"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => onRemoveTech(tech)}
                      className="text-accent-500 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <Icon icon="mingcute:close-line" className="w-3.5 h-3.5" />
                    </button>
                  </motion.span>
                ))}
              </AnimatePresence>
            </div>
          )}
          {errors.techstack && <FieldError>{errors.techstack}</FieldError>}
          <FieldDescription>{t("friends.apply.details.techStackDescription")}</FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
