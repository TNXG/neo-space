import { FloatingNav } from "@/components/common/navigation";
import { NbnhhshPanel, NbnhhshProvider } from "@/components/common/nbnhhsh";
import { Footer } from "@/components/layouts/Footer";
import { PageProvider } from "@/contexts/PageContext";
import { getUserProfile } from "@/lib/api-client";

/**
 * 主站布局 - 包含 Footer、FloatingNav 和 Nbnhhsh
 * 适用于所有主站内容页面（首页、文章、日记等）
 */
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profileResponse = await getUserProfile().catch(() => ({
    data: {
      _id: "",
      username: "guest",
      name: "访客用户",
      introduce: "欢迎来到我的博客",
      avatar: "/default-avatar.png",
      mail: "",
      url: "",
      created: new Date().toISOString(),
      last_login_time: new Date().toISOString(),
    },
  }));

  return (
    <PageProvider>
      <NbnhhshProvider>
        <div className="flex flex-col min-h-screen">
          <FloatingNav user={profileResponse.data} />
          <main className="flex-1 pt-20">
            {children}
          </main>
          <Footer user={profileResponse.data} />
        </div>
        <NbnhhshPanel />
      </NbnhhshProvider>
    </PageProvider>
  );
}
