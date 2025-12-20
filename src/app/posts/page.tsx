import type { Metadata } from "next";
import { InteractiveList } from "@/components/common/InteractiveList";
import { getPosts } from "@/lib/api-client";

export const metadata: Metadata = {
	title: "Starlight | 文章",
	description: "我们在舞台上演奏的交响曲",
};

export const dynamic = "force-dynamic";

interface PageProps {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PostsPage({ searchParams }: PageProps) {
	const params = await searchParams;
	const page = Number(params.page) || 1;
	const pageSize = 10;
	const { data } = await getPosts(page, pageSize);

	const totalItems = data.pagination.total || 0;
	const totalPages = data.pagination.total_page || Math.ceil(totalItems / pageSize);

	return (
		<main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-6xl">
			<header className="mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
				{/*
                   主标题区域
                   中文: 星辉 (Starlight)
                   配色: Stone -> Teal 渐变
                */}
				<div className="mb-4 md:mb-6 flex flex-col items-center">
					<h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-r from-primary-800 to-accent-600 bg-clip-text text-transparent leading-tight py-2 select-none">
						星 辉
					</h1>
					<span className="text-xs md:text-sm lg:text-base font-medium tracking-[0.3em] text-accent-600/60 uppercase mt-1 font-mono">
						Starlight
					</span>
				</div>

				{/*
                   副标题区域
                   中文: 于是，我们化作群星
                   英文: And so, we become stars
                */}
				<div className="text-primary-600 font-medium flex items-center justify-center gap-3 md:gap-4 w-full">
					<span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70"></span>
					<div className="flex flex-col items-center justify-center text-center">
						<span className="text-base md:text-lg lg:text-xl tracking-wide text-primary-700">
							于是，我们化作群星
						</span>
						<span className="text-[11px] md:text-xs lg:text-sm text-primary-400/80 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
							And so, we become stars
						</span>
					</div>
					<span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70"></span>
				</div>
			</header>

			<InteractiveList
				items={data.items}
				pagination={{
					currentPage: page,
					totalPages,
				}}
				type="post"
				emptyMessage="选择一篇文章查看详情"
			/>
		</main>
	);
}
