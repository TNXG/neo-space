"use client";

import type { LinkApplyFormData } from "@/lib/validations/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "motion/react";
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

const STEPS: { id: Step; title: string; icon: string }[] = [
  { id: "guidelines", title: "申请须知", icon: "mingcute:information-line" },
  { id: "verification", title: "身份验证", icon: "mingcute:shield-shape-line" },
  { id: "basic", title: "基础信息", icon: "mingcute:idcard-line" },
  { id: "details", title: "站点详情", icon: "mingcute:monitor-line" },
];

// -----------------------------------------------------------------------------
// 主组件
// -----------------------------------------------------------------------------

export function LinkApplyForm() {
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
        toast.warning("最多添加 6 个技术栈标签");
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
    const stepId = STEPS[currentStep].id;
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
          toast.success("验证码已发送", { description: "请查收邮件" });
        } else {
          throw new Error(result.message || "发送失败");
        }
      } catch (e: any) {
        if (e.message?.includes("429") || e.message?.includes("TooManyRequests")) {
          toast.error("发送过于频繁", { description: "请稍后再试" });
        } else {
          toast.error(e.message || "发送失败，请稍后重试");
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
          toast.success("申请已提交", { description: "审核通过后将自动显示在友链列表中" });
          reset();
          setIsCodeSent(false);
          setCurrentStep(0);
          setIsOpen(false);
        } else {
          throw new Error(result.message || "申请失败");
        }
      } catch (e: any) {
        if (e.message?.includes("409") || e.message?.includes("Conflict")) {
          toast.error("该站点已存在");
        } else if (e.message?.includes("400") || e.message?.includes("BadRequest")) {
          toast.error("验证码错误或已过期", { description: "请重新获取验证码" });
        } else {
          toast.error(e.message || "申请失败，请稍后重试");
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
      {STEPS.map((step, index) => {
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
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-300 shadow-sm",
                isActive && "ring-4 ring-accent-100",
              )}
            >
              <Icon icon={isCompleted ? "mingcute:check-fill" : step.icon} className="w-5 h-5" />
            </motion.div>
            <span className={cn("text-xs mt-2 font-medium transition-colors duration-300", isActive ? "text-accent-600" : "text-muted-foreground")}>
              {step.title}
            </span>
            {index < STEPS.length - 1 && (
              <div className="absolute left-[calc(50%+20px)] top-5 w-[calc(100vw/4-40px)] sm:w-22.5 h-0.5 -z-10 bg-secondary">
                <motion.div initial={{ width: "0%" }} animate={{ width: isCompleted ? "100%" : "0%" }} className="h-full bg-accent-500 transition-all duration-500" />
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
          预览效果
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
              <h3 className="font-semibold truncate text-sm text-foreground">{formData.name || "站点名称"}</h3>
              <span className="text-[10px] text-muted-foreground/60 font-mono truncate">{getHostname(formData.url)}</span>
            </div>
            <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1 leading-relaxed">{formData.description || "这里将显示你的站点简介..."}</p>
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
          className="group relative flex items-center gap-3 px-8 py-4 bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-lg hover:shadow-xl hover:bg-card transition-all duration-300 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-accent-500/10 flex items-center justify-center text-accent-600 group-hover:bg-accent-500 group-hover:text-white transition-colors duration-300">
            <Icon icon="mingcute:add-line" className="w-5 h-5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">申请加入友链</div>
            <div className="text-xs text-muted-foreground">与我建立连接</div>
          </div>
        </button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Icon icon="mingcute:user-add-2-line" className="w-5 h-5 text-accent-500" />
              申请友链
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
                上一步
              </Button>

              {currentStep === STEPS.length - 1
                ? (
                    <Button type="submit" disabled={isPending || !formData.code}>
                      {isPending
                        ? (
                            <>
                              <Icon icon="mingcute:loading-line" className="w-4 h-4 animate-spin" />
                              提交中...
                            </>
                          )
                        : (
                            <>
                              提交申请
                              <Icon icon="mingcute:send-plane-fill" className="w-4 h-4" />
                            </>
                          )}
                    </Button>
                  )
                : (
                    <Button type="button" onClick={handleNextStep}>
                      下一步
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
