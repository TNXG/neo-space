"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import { Icon } from "@iconify/react";

import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";

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
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>
          <Icon icon="mingcute:text-line" className="w-3.5 h-3.5" />
          站点描述
        </FieldLabel>
        <FieldContent>
          <textarea
            {...register("description")}
            placeholder="简单介绍一下你的站点..."
            className="form-input min-h-[100px] resize-none"
            autoFocus
          />
          {errors.description && <FieldError>{errors.description}</FieldError>}
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:rss-line" className="w-3.5 h-3.5" />
          RSS 地址
        </FieldLabel>
        <FieldContent>
          <input
            {...register("rssurl")}
            type="url"
            placeholder="https://example.com/feed.xml"
            className="form-input"
          />
          {errors.rssurl && <FieldError>{errors.rssurl}</FieldError>}
          <FieldDescription>可选，用于订阅你的最新文章</FieldDescription>
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:code-line" className="w-3.5 h-3.5" />
          技术栈
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
              placeholder="例如: Next.js"
              className="form-input flex-1"
            />
            <Button type="button" variant="secondary" size="sm" onClick={onAddTech}>
              添加
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
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 rounded-lg border border-accent-200 dark:border-accent-800"
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
          <FieldDescription>可选，最多 6 个标签，按 Enter 添加</FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}
