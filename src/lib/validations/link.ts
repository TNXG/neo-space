import { z } from "zod";

/**
 * 友链申请表单验证 Schema
 */
export const linkApplySchema = z.object({
  // 申请须知
  agreedToGuidelines: z
    .boolean()
    .refine(val => val === true, {
      message: "请阅读并同意友链指南",
    }),

  // 基础信息
  name: z
    .string()
    .min(1, "站点名称不能为空")
    .max(50, "站点名称不能超过 50 个字符"),

  url: z
    .string()
    .min(1, "站点地址不能为空")
    .url("请输入有效的 URL 地址")
    .refine(url => url.startsWith("http://") || url.startsWith("https://"), {
      message: "URL 必须以 http:// 或 https:// 开头",
    }),

  avatar: z
    .string()
    .min(1, "头像地址不能为空")
    .url("请输入有效的头像 URL 地址"),

  // 站点详情
  description: z
    .string()
    .min(1, "站点描述不能为空")
    .min(10, "站点描述至少需要 10 个字符")
    .max(200, "站点描述不能超过 200 个字符"),

  rssurl: z
    .string()
    .url("请输入有效的 RSS URL 地址")
    .optional()
    .or(z.literal("")),

  techstack: z
    .array(z.string())
    .max(6, "最多添加 6 个技术栈标签")
    .optional(),

  // 身份验证
  email: z
    .string()
    .min(1, "邮箱地址不能为空")
    .email("请输入有效的邮箱地址"),

  code: z
    .string()
    .min(6, "验证码必须是 6 位")
    .max(6, "验证码必须是 6 位")
    .regex(/^\d{6}$/, "验证码必须是 6 位数字"),
});

/**
 * 友链申请表单类型
 */
export type LinkApplyFormData = z.infer<typeof linkApplySchema>;

/**
 * 分步骤验证 Schema
 */
export const linkApplyStepSchemas = {
  guidelines: linkApplySchema.pick({
    agreedToGuidelines: true,
  }),

  verification: linkApplySchema.pick({
    email: true,
    code: true,
  }),

  basic: linkApplySchema.pick({
    name: true,
    url: true,
    avatar: true,
  }),

  details: linkApplySchema.pick({
    description: true,
    rssurl: true,
    techstack: true,
  }),
};
