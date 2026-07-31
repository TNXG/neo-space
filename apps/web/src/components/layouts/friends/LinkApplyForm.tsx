"use client";

import type { LinkApplyFormData } from "@/lib/validations/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyLink, sendLinkVerificationCode } from "@/lib/api-client";
import { Icon } from "@/lib/inline-icon";
import { cn } from "@/lib/utils";
import { linkApplySchema, linkApplyStepSchemas } from "@/lib/validations/link";

import { BasicInfoStep } from "./steps/BasicInfoStep";
import { DetailsStep } from "./steps/DetailsStep";
import { GuidelinesStep } from "./steps/GuidelinesStep";
import { VerificationStep } from "./steps/VerificationStep";

// -----------------------------------------------------------------------------
// 类型定义
// -----------------------------------------------------------------------------

type Step = "guidelines" | "verification" | "basic" | "details";

// -----------------------------------------------------------------------------
// 主组件
// -----------------------------------------------------------------------------

export function LinkApplyForm() {
  const t = useTranslations();

  const steps: { id: Step; title: string; icon: string }[] = [
    { id: "guidelines", title: t("friends.apply.steps.guidelines"), icon: "mingcute:information-line" },
    { id: "verification", title: t("friends.apply.steps.verification"), icon: "mingcute:shield-shape-line" },
    { id: "basic", title: t("friends.apply.steps.basic"), icon: "mingcute:idcard-line" },
    { id: "details", title: t("friends.apply.steps.details"), icon: "mingcute:monitor-line" },
  ];

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isPending, startTransition] = useTransition();
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [techInput, setTechInput] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    trigger,
    reset,
  } = useForm<LinkApplyFormData>({
    resolver: zodResolver(linkApplySchema),
    mode: "onChange",
    defaultValues: {
      agreedToGuidelines: false,
      name: "",
      url: "",
      avatar: "",
      description: "",
      email: "",
      rssurl: "",
      techstack: [],
      code: "",
    },
  });

  // react-hook-form 的 watch() 是订阅式代理，React Compiler 无法静态分析，按预期跳过此组件的自动 memo 化。
  // eslint-disable-next-line react-hooks/incompatible-library
  const formData = watch();

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // -------------------------------------------------------------------------
  // 处理函数
  // -------------------------------------------------------------------------

  const handleAddTech = () => {
    if (techInput.trim() && !formData.techstack?.includes(techInput.trim())) {
      const currentTechstack = formData.techstack || [];
      if (currentTechstack.length >= 6) {
        toast.warning(t("friends.apply.toast.techstackLimit"));
        return;
      }
      setValue("techstack", [...currentTechstack, techInput.trim()]);
      setTechInput("");
    }
  };

  const handleRemoveTech = (tech: string) => {
    const currentTechstack = formData.techstack || [];
    setValue("techstack", currentTechstack.filter(t => t !== tech));
  };

  const handleNextStep = async () => {
    const stepId = steps[currentStep].id;
    const schema = linkApplyStepSchemas[stepId];
    const isValid = await trigger(Object.keys(schema.shape) as any);

    if (isValid) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const handleSendCode = async () => {
    const isValid = await trigger("email");
    if (!isValid)
      return;

    startTransition(async () => {
      try {
        const result = await sendLinkVerificationCode(formData.email);
        if (result.status === "success") {
          setIsCodeSent(true);
          setCountdown(60);
          toast.success(t("friends.apply.toast.codeSent"), {
            description: t("friends.apply.toast.checkEmail"),
          });
        } else {
          throw new Error(result.message || t("friends.apply.toast.sendFailed"));
        }
      } catch (e: any) {
        if (e.message?.includes("429") || e.message?.includes("TooManyRequests")) {
          toast.error(t("friends.apply.toast.sendTooFrequent"), {
            description: t("friends.apply.toast.retryLater"),
          });
        } else {
          toast.error(e.message || t("friends.apply.toast.sendRetry"));
        }
      }
    });
  };

  const onSubmit = (data: LinkApplyFormData) => {
    startTransition(async () => {
      try {
        const result = await applyLink({
          name: data.name,
          url: data.url,
          avatar: data.avatar,
          description: data.description,
          email: data.email,
          code: data.code,
          rssurl: data.rssurl || undefined,
          techstack: data.techstack?.length ? data.techstack : undefined,
        });

        if (result.status === "success") {
          toast.success(t("friends.apply.toast.submitSuccess"), {
            description: t("friends.apply.toast.submitSuccessDescription"),
          });
          reset();
          setIsCodeSent(false);
          setCurrentStep(0);
          setIsOpen(false);
        } else {
          throw new Error(result.message || t("friends.apply.toast.submitFailed"));
        }
      } catch (e: any) {
        if (e.message?.includes("409") || e.message?.includes("Conflict")) {
          toast.error(t("friends.apply.toast.siteExists"));
        } else if (e.message?.includes("400") || e.message?.includes("BadRequest")) {
          toast.error(t("friends.apply.toast.codeInvalidOrExpired"), {
            description: t("friends.apply.toast.regetCode"),
          });
        } else {
          toast.error(e.message || t("friends.apply.toast.submitRetry"));
        }
      }
    });
  };

  const getHostname = (url: string): string => {
    if (!url.trim())
      return "example.com";
    try {
      const urlWithProtocol = url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
      return new URL(urlWithProtocol).hostname;
    } catch {
      return url.includes(".") ? url.split("/")[0] : "example.com";
    }
  };

  // -------------------------------------------------------------------------
  // 渲染组件
  // -------------------------------------------------------------------------

  const renderProgressBar = () => (
    <div className="flex justify-between items-center mb-8 px-2">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        return (
          <div key={step.id} className="flex flex-col items-center relative z-10">
            <motion.div
              initial={false}
              animate={{
                backgroundColor: isActive || isCompleted ? "var(--accent-500)" : "var(--primary-200)",
                color: isActive || isCompleted ? "#ffffff" : "var(--primary-500)",
                scale: isActive ? 1.1 : 1,
              }}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 shadow-sm",
                isActive && "ring-4 ring-accent-100",
              )}
            >
              <Icon icon={isCompleted ? "mingcute:check-fill" : step.icon} className="w-5 h-5" />
            </motion.div>
            <span className={cn("text-xs mt-2 font-medium transition-colors duration-200", isActive ? "text-accent-600" : "text-muted-foreground")}>
              {step.title}
            </span>
            {index < steps.length - 1 && (
              <div className="absolute left-[calc(50%+20px)] top-5 w-[calc(100vw/4-40px)] sm:w-22.5 h-0.5 -z-10 bg-secondary">
                <motion.div
                  initial={false}
                  animate={{ transform: `scaleX(${isCompleted ? 1 : 0})` }}
                  transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                  className="h-full origin-left bg-accent-500"
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderLivePreview = () => {
    if (currentStep < 2)
      return null;

    return (
      <div className="mb-6 p-4 bg-secondary/20 rounded-2xl border border-dashed border-border/60">
        <div className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
          <Icon icon="mingcute:eye-2-line" className="w-3.5 h-3.5" />
          {t("friends.apply.preview.title")}
        </div>
        <div className="flex items-start gap-3 p-3 bg-card border border-border/50 rounded-xl shadow-sm">
          <div className="relative shrink-0">
            {formData.avatar
              ? (
                  <img src={formData.avatar} alt="Avatar" className="w-12 h-12 rounded-xl object-cover bg-secondary" />
                )
              : (
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground/30">
                    <Icon icon="mingcute:user-3-line" className="w-6 h-6" />
                  </div>
                )}
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 border-2 border-card" />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate text-sm text-foreground">{formData.name || t("friends.apply.preview.siteNameFallback")}</h3>
              <span className="text-[10px] text-muted-foreground/60 font-mono truncate">{getHostname(formData.url)}</span>
            </div>
            <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1 leading-relaxed">{formData.description || t("friends.apply.preview.siteDescriptionFallback")}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <GuidelinesStep
              register={register}
              setValue={setValue}
              checked={formData.agreedToGuidelines}
              error={errors.agreedToGuidelines?.message}
            />
          </motion.div>
        );

      case 1:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <VerificationStep
              register={register}
              setValue={setValue}
              code={formData.code}
              isCodeSent={isCodeSent}
              isPending={isPending}
              countdown={countdown}
              onSendCode={handleSendCode}
              emailError={errors.email?.message}
              codeError={errors.code?.message}
            />
          </motion.div>
        );

      case 2:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <BasicInfoStep
              register={register}
              errors={{
                name: errors.name?.message,
                url: errors.url?.message,
                avatar: errors.avatar?.message,
              }}
            />
          </motion.div>
        );

      case 3:
        return (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <DetailsStep
              register={register}
              setValue={setValue}
              techstack={formData.techstack || []}
              techInput={techInput}
              onTechInputChange={setTechInput}
              onAddTech={handleAddTech}
              onRemoveTech={handleRemoveTech}
              errors={{
                description: errors.description?.message,
                rssurl: errors.rssurl?.message,
                techstack: errors.techstack?.message,
              }}
            />
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="mt-12 flex justify-center pb-20">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-3 px-8 py-4 bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl transition-colors duration-200 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-accent-500/10 flex items-center justify-center text-accent-600 group-hover:bg-accent-500 group-hover:text-white transition-colors duration-200">
            <Icon icon="mingcute:add-line" className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">{t("friends.apply.open.title")}</div>
            <div className="text-xs text-muted-foreground">{t("friends.apply.open.subtitle")}</div>
          </div>
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="mingcute:user-add-2-line" className="w-5 h-5 text-accent-500" />
              {t("friends.apply.dialogTitle")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogBody className="px-6 py-4">
              {renderProgressBar()}
              {renderLivePreview()}
              <div className="min-h-50">{renderStepContent()}</div>
            </DialogBody>

            <DialogFooter className="px-6 py-4 flex-row justify-between">
              <Button type="button" variant="outline" onClick={handlePrevStep} disabled={currentStep === 0 || isPending} className={cn(currentStep === 0 && "opacity-0 pointer-events-none")}>
                {t("friends.apply.actions.previous")}
              </Button>

              {currentStep === steps.length - 1
                ? (
                    <Button type="submit" disabled={isPending || !formData.code}>
                      {isPending
                        ? (
                            <>
                              <Icon icon="mingcute:loading-line" className="w-4 h-4 animate-spin" />
                              {t("friends.apply.actions.submitting")}
                            </>
                          )
                        : (
                            <>
                              {t("friends.apply.actions.submit")}
                              <Icon icon="mingcute:send-plane-fill" className="w-4 h-4" />
                            </>
                          )}
                    </Button>
                  )
                : (
                    <Button type="button" onClick={handleNextStep}>
                      {t("friends.apply.actions.next")}
                      <Icon icon="mingcute:arrow-right-line" className="w-4 h-4" />
                    </Button>
                  )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
