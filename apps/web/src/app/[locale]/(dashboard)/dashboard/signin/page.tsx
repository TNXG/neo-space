import type { Metadata } from "next";
import { LoginPanel } from "@/components/business/dashboard/sign/LoginPanel";

export const metadata: Metadata = { title: "后台登录" };

/** 登录选项、会话与凭据请求均由浏览器直接访问 Rust。 */
export default function LoginPage() {
  return <LoginPanel />;
}
