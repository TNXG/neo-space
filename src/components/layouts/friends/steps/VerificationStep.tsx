"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { LinkApplyFormData } from "@/lib/validations/link";
import { Icon } from "@iconify/react/offline";

import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

interface VerificationStepProps {
  register: UseFormRegister<LinkApplyFormData>;
  setValue: UseFormSetValue<LinkApplyFormData>;
  code: string;
  isCodeSent: boolean;
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
  countdown,
  onSendCode,
  emailError,
  codeError,
}: VerificationStepProps) {
  return (
    <FieldGroup>
      <div className="p-4 bg-accent-50/50 dark:bg-accent-900/10 border border-accent-100 dark:border-accent-900/30 rounded-xl text-sm text-accent-800 dark:text-accent-300">
        <div className="flex items-start gap-2">
          <Icon icon="mingcute:safe-flash-line" className="w-5 h-5 shrink-0 mt-0.5" />
          <p>我们需要验证你的邮箱以确保你是站长本人，并用于接收友链申请结果通知。</p>
        </div>
      </div>

      <Field>
        <FieldLabel>
          <Icon icon="mingcute:mail-line" className="w-3.5 h-3.5" />
          联系邮箱
        </FieldLabel>
        <FieldContent>
          <div className="flex gap-2">
            <input
              {...register("email")}
              type="email"
              placeholder="填写您用于接收验证码的邮箱"
              className="form-input flex-1"
              disabled={isCodeSent}
              autoFocus
            />
            <Button
              type="button"
              variant={isCodeSent && countdown > 0 ? "secondary" : "default"}
              onClick={onSendCode}
              disabled={isCodeSent && countdown > 0}
              className="min-w-[100px] shrink-0"
            >
              {isCodeSent && countdown > 0 ? `${countdown}s` : "发送验证码"}
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
                验证码
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
                  请输入邮件中的 6 位数字验证码
                </FieldDescription>
              </FieldContent>
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
    </FieldGroup>
  );
}
