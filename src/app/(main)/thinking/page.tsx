import type { Metadata } from "next";
import { ThinkingItem } from "@/components/layouts/thinking/ThinkingItem";
import { ThinkingList } from "@/components/layouts/thinking/ThinkingList";
import { getRecently } from "@/lib/api-client";

export const metadata: Metadata = {
  title: "碎碎念 | Thinking",
  description: "记录日常所思所想",
};

export const revalidate = 3600;

/**
 * 碎碎念页面 - 流式展示
 * 使用 Server Components 和 Server Action 实现无限加载
 */
export default async function ThinkingPage() {
  const limit = 50;
  // 获取首屏数据，支持 SSR
  const initialDataResponse = await getRecently(limit);
  const items = initialDataResponse.data.items;
  const initialHasNextPage = initialDataResponse.data.pagination.has_next_page;
  const isEmpty = items.length === 0;

  // 在服务端渲染首屏的节点
  const initialNodes = items.map(item => <ThinkingItem key={item._id} item={item} />);

  return (
    <main className="container mx-auto px-4 py-16 max-w-4xl">
      {/* 页面头部 */}
      <header className="mb-16 text-center max-w-2xl mx-auto flex flex-col items-center">
        <div className="mb-6 flex flex-col items-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-linear-to-r from-primary-600 to-accent-500 bg-clip-text text-transparent leading-tight py-2 select-none">
            碎碎念
          </h1>
          <span className="text-sm md:text-base font-medium tracking-[0.3em] text-primary-500/60 uppercase mt-1 font-mono">
            Thinking
          </span>
        </div>

        <div className="text-primary-600 font-medium flex items-center justify-center gap-4 w-full">
          <span className="w-8 md:w-12 h-px bg-primary-300 inline-block opacity-70" />
          <div className="flex flex-col items-center justify-center text-center">
            <span className="text-lg md:text-xl tracking-wide text-primary-700">
              记录日常所思所想
            </span>
            <span className="text-xs md:text-sm text-primary-400/80 font-normal italic tracking-wide mt-1 font-serif">
              Bits and pieces of thoughts
            </span>
          </div>
          <span className="w-8 md:w-12 h-px bg-primary-300 inline-block opacity-70" />
        </div>
      </header>

      {/* 碎碎念列表客户端组件 */}
      <ThinkingList
        initialNodes={initialNodes}
        initialHasNextPage={initialHasNextPage}
        isEmpty={isEmpty}
      />
    </main>
  );
}
