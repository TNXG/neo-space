import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "管理面板",
  robots: { index: false, follow: false },
};

/** 后台路由只共享元数据；登录场景与工作区分别提供自己的外壳。 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
