/**
 * 邮件服务 - 从数据库读取 SMTP 配置并发送邮件
 * 对标 Rust backend 的 EmailService
 */

import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";
import { getDb } from "@/lib/db";

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  encryption: "tls" | "starttls" | "none";
}

/**
 * 从数据库获取邮件配置
 */
async function getEmailConfig(): Promise<EmailConfig> {
  const db = await getDb();
  const collection = db.collection("options");

  const option = await collection.findOne({ name: "email" });
  if (!option || !option.value) {
    throw new Error("邮件配置未找到");
  }

  const config = option.value;

  return {
    host: config.host || "smtp.gmail.com",
    port: config.port || 587,
    user: config.user || "",
    password: config.password || "",
    fromEmail: config.fromEmail || config.user || "",
    fromName: config.fromName || "Neo Space",
    encryption: config.encryption || "starttls",
  };
}

/**
 * 创建邮件传输器
 */
async function createTransporter(): Promise<Transporter> {
  const config = await getEmailConfig();

  const transportOptions: any = {
    host: config.host,
    port: config.port,
    auth: {
      user: config.user,
      pass: config.password,
    },
  };

  // 根据加密方式配置
  if (config.encryption === "tls") {
    transportOptions.secure = true; // 端口 465
  } else if (config.encryption === "starttls") {
    transportOptions.secure = false; // 端口 587
    transportOptions.requireTLS = true;
  } else {
    transportOptions.secure = false;
  }

  return nodemailer.createTransporter(transportOptions);
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationEmail(
  toEmail: string,
  code: string,
  siteName = "Neo Space",
): Promise<void> {
  try {
    const config = await getEmailConfig();
    const transporter = await createTransporter();

    const currentYear = new Date().getFullYear();

    // HTML 邮件内容
    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, sans-serif; background: #f4f7f6; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 30px; text-align: center; color: white; }
        .content { padding: 40px 30px; }
        .code-container { background: #f0fdfa; border: 2px dashed #14b8a6; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .code { font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px; }
        .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header"><h1>验证码</h1></div>
        <div class="content">
            <p>你好！</p>
            <p>感谢你访问 <strong>${siteName}</strong>。请使用下方的验证码完成操作：</p>
            <div class="code-container">
                <div class="code">${code}</div>
                <p style="font-size: 12px; color: #666;">有效期 10 分钟</p>
            </div>
            <p style="color: #92400e; font-size: 13px;">⚠️ 如果非本人操作，请忽略此邮件。</p>
        </div>
        <div class="footer">
            <p>© ${currentYear} ${siteName} · Powered by Neo Space</p>
        </div>
    </div>
</body>
</html>
`;

    const textBody = `你好！\n\n你的验证码是：${code}\n\n有效期 10 分钟。\n\n© ${currentYear} ${siteName}`;

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: toEmail,
      subject: `[${siteName}] 验证码`,
      text: textBody,
      html: htmlBody,
    });

    console.log(`[Email] 邮件已成功发送至: ${toEmail}`);
  } catch (error) {
    console.error(`[Email] 邮件发送失败:`, error);
    throw new Error(`邮件发送失败: ${error}`);
  }
}

/**
 * 发送友链申请通知邮件
 */
export async function sendLinkApplicationNotification(
  adminEmail: string,
  linkName: string,
  linkUrl: string,
): Promise<void> {
  try {
    const config = await getEmailConfig();
    const transporter = await createTransporter();

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, sans-serif; line-height: 1.6; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #0d9488; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .link-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>新的友链申请</h2>
        </div>
        <div class="content">
            <p>你好！</p>
            <p>有新的友链申请需要审核：</p>
            <div class="link-info">
                <p><strong>友链名称：</strong>${linkName}</p>
                <p><strong>友链地址：</strong><a href="${linkUrl}">${linkUrl}</a></p>
            </div>
            <p>请登录后台进行审核。</p>
        </div>
    </div>
</body>
</html>
`;

    await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: adminEmail,
      subject: `[友链申请] ${linkName}`,
      html: htmlBody,
    });

    console.log(`[Email] 友链申请通知已发送至: ${adminEmail}`);
  } catch (error) {
    console.error(`[Email] 友链申请通知发送失败:`, error);
    throw new Error(`邮件发送失败: ${error}`);
  }
}
