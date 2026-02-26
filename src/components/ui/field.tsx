"use client";

import { useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import WarningLine from "~icons/mingcute/warning-line";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { DashedSeparator } from "@/components/ui/separator";

// -----------------------------------------------------------------------------
// FieldSet - 表单字段集合容器
// -----------------------------------------------------------------------------

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6",
        "has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// FieldLegend - 字段集合标题
// -----------------------------------------------------------------------------

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-3 font-semibold text-foreground",
        "data-[variant=legend]:text-base",
        "data-[variant=label]:text-sm",
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// FieldGroup - 字段组容器
// -----------------------------------------------------------------------------

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group",
        "flex w-full flex-col gap-6",
        "data-[slot=checkbox-group]:gap-3",
        "*:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// Field - 单个字段容器
// -----------------------------------------------------------------------------

const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: ["flex-col [&>*]:w-full [&>.sr-only]:w-auto"],
        horizontal: [
          "flex-row items-center",
          "[&>[data-slot=field-label]]:flex-auto",
          "has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
        responsive: [
          "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
          "@md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto",
          "@md/field-group:[&>[data-slot=field-label]]:flex-auto",
          "@md/field-group:has-[>[data-slot=field-content]]:items-start",
          "@md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        ],
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
);

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// FieldContent - 字段内容区域
// -----------------------------------------------------------------------------

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn(
        "group/field-content flex flex-1 flex-col gap-2 leading-snug",
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// FieldLabel - 字段标签
// -----------------------------------------------------------------------------

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label",
        "flex w-fit gap-2 leading-snug",
        "group-data-[disabled=true]/field:opacity-50",
        // 嵌套 Field 样式
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        "has-[>[data-slot=field]]:rounded-xl has-[>[data-slot=field]]:border has-[>[data-slot=field]]:border-border/50",
        "*:data-[slot=field]:p-4",
        // 选中状态 - 使用 accent 色
        "has-data-[state=checked]:bg-accent-50 has-data-[state=checked]:border-accent-500",
        "dark:has-data-[state=checked]:bg-accent-900/20",
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// FieldTitle - 字段标题 (不带 label 语义)
// -----------------------------------------------------------------------------

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2",
        "text-sm font-semibold leading-snug text-foreground",
        "group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// FieldDescription - 字段描述文本
// -----------------------------------------------------------------------------

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-muted-foreground text-sm leading-relaxed font-normal",
        "group-has-data-[orientation=horizontal]/field:text-balance",
        "last:mt-0 nth-last-2:-mt-1 [[data-variant=legend]+&]:-mt-1.5",
        // 链接样式 - 使用 accent 色
        "[&>a]:text-accent-600 [&>a]:underline [&>a]:underline-offset-4",
        "[&>a:hover]:text-accent-500",
        className
      )}
      {...props}
    />
  );
}

// -----------------------------------------------------------------------------
// FieldSeparator - 字段分隔线
// -----------------------------------------------------------------------------

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode;
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-1 h-6 text-sm",
        "group-data-[variant=outline]/field-group:-mb-1",
        className
      )}
      {...props}
    >
      <DashedSeparator className="absolute inset-0 top-1/2 my-0" />
      {children && (
        <span
          className="bg-background text-muted-foreground relative mx-auto block w-fit px-3 text-xs font-medium uppercase tracking-wider"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// FieldError - 字段错误提示
// -----------------------------------------------------------------------------

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: Array<{ message?: string } | undefined>;
}) {
  const content = useMemo(() => {
    if (children) {
      return children;
    }

    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors?.length === 1) {
      return uniqueErrors[0]?.message;
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map(
          (error, index) =>
            error?.message && <li key={index}>{error.message}</li>
        )}
      </ul>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn(
        "flex items-start gap-1.5 text-sm font-normal text-red-500",
        className
      )}
      {...props}
    >
      <WarningLine className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{content}</span>
    </div>
  );
}

export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
