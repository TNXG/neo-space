import type { Metadata } from "next";
import { ContentEditor } from "@/components/dashboard/content/ContentEditor";

type PostEditorRouteProps = { params: Promise<{ id: string }>; searchParams: Promise<{ draft?: string }> };

export async function generateMetadata({ params }: PostEditorRouteProps): Promise<Metadata> {
  const { id } = await params;
  return { title: id === "new" ? "写文章" : "编辑文章" };
}

/** `new` 为新建（`?draft=` 继续服务端草稿），其余参数视为文章 `_id`；正文在客户端读取。 */
export default async function DashboardPostEditorPage({ params, searchParams }: PostEditorRouteProps) {
  const { id } = await params;
  const { draft } = await searchParams;
  return <ContentEditor key={id} kind="post" _id={id === "new" ? undefined : id} resumeDraftId={id === "new" ? draft : undefined} />;
}
