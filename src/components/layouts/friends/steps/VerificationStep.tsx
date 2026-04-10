"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Icon } from "@/lib/inline-icon";

interface VerificationStepProps {
  register: UseFormRegister<LinkApplyFormData>;
  setValue: UseFormSetValue<LinkApplyFormData>;
  code: string;
  isCodeSent: boolean;
  isPending: boolean;
  countdown: number;
  onSendCode: () => void;
  emailError?: string;
  codeError?: string;
}

export function VerificationStep({
  register,
  setValue,
  code,
  isCodeSent,
  isPending,
  countdown,
  onSendCode,
  emailError,
  codeError,
}: VerificationStepProps) {
  const t = useTranslations();

  return (
    <FieldGroup>
      <div className="p-4 bg-accent-50/50 border border-accent-100 rounded-xl text-sm text-accent-800">
        <div className="flex items-start gap-2">
          <Icon icon="mingcute:safe-flash-line" className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{t("friends.apply.verification.intro")}</p>
        </div>
      </div>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:mail-line" className="w-3.5 h-3.5" />
          {t("friends.apply.verification.emailLabel")}
        </FieldLabel>
        <FieldContent>
          <div className="flex gap-2">
            <input
              {...register("email")}
              type="email"
              placeholder={t("friends.apply.verification.emailPlaceholder")}
              className="form-input flex-1"
              disabled={isCodeSent}
              autoFocus
            />
            <Button
              type="button"
              variant={isCodeSent && countdown > 0 ? "secondary" : "default"}
              onClick={onSendCode}
              disabled={isPending || (isCodeSent && countdown > 0)}
              className="min-w-25 shrink-0"
            >
              {isPending
                ? (
                    <Icon icon="mingcute:loading-3-line" className="w-4 h-4 animate-spin" />
                  )
                : isCodeSent && countdown > 0
                  ? `${countdown}s`
                  : t("friends.apply.actions.sendCode")}
            </Button>
          </div>
          {emailError && <FieldError>{emailError}</FieldError>}
        </FieldContent>
      </Field>

      <AnimatePresence>
        {isCodeSent && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Field>
              <FieldLabel>
                <Icon icon="mingcute:key-2-line" className="w-3.5 h-3.5" />
                {t("friends.apply.verification.codeLabel")}
              </FieldLabel>
              <FieldContent>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={value => setValue("code", value)}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {codeError && <FieldError>{codeError}</FieldError>}
                <FieldDescription className="text-center">
                  {t("friends.apply.verification.codeDescription")}
                </FieldDescription>
              </FieldContent>
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
    </FieldGroup>
  );
}
