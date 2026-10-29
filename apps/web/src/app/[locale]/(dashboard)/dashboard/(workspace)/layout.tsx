import type { ReactNode } from "react";
import { DashboardWorkspace } from "@/components/dashboard/DashboardWorkspace";

/** 工作区外壳在路由间保持挂载，切换页面不重建侧栏与会话守卫。 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return <DashboardWorkspace>{children}</DashboardWorkspace>;
}
