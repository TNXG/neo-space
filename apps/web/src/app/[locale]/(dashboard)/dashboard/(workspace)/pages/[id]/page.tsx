import type { Metadata } from "next";
import { ContentEditor } from "@/components/dashboard/content/ContentEditor";

type PageEditorRouteProps = { params: Promise<{ id: string }>; searchParams: Promise<{ draft?: string }> };

export async function generateMetadata({ params }: PageEditorRouteProps): Promise<Metadata> {
  const { id } = await params;
  return { title: id === "new" ? "新建页面" : "编辑页面" };
}

/** `new` 为新建（`?draft=` 继续服务端草稿），其余参数视为页面 `_id`；正文在客户端读取。 */
export default async function DashboardPageEditorPage({ params, searchParams }: PageEditorRouteProps) {
  const { id } = await params;
  const { draft } = await searchParams;
  return <ContentEditor key={id} kind="page" _id={id === "new" ? undefined : id} resumeDraftId={id === "new" ? draft : undefined} />;
}
