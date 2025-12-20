import type { Metadata } from "next";
import { InteractiveList } from "@/components/common/InteractiveList";
import { getNotes } from "@/lib/api-client";

export const metadata: Metadata = {
	title: "Sparkle | 手记",
	description: "寻找生活中的星之鼓动",
};

export const dynamic = "force-dynamic";

interface PageProps {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function NotesPage({ searchParams }: PageProps) {
	const params = await searchParams;
	const page = Number(params.page) || 1;
	const pageSize = 10;

	const { data } = await getNotes(page, pageSize);

	const totalItems = data.pagination.total || 0;
	const totalPages = data.pagination.total_page || Math.ceil(totalItems / pageSize);

	return (
		<main className="container mx-auto px-4 py-16 max-w-6xl">
			<header className="mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center">
				{/*
                   主标题区域
                   中文: 微光 (Sparkle)
                   配色: Teal -> Stone 渐变 (强调 Accent)
                */}
				<div className="mb-6 flex flex-col items-center">
					<h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-linear-to-r from-accent-600 to-primary-600 bg-clip-text text-transparent leading-tight py-2 select-none">
						微 光
					</h1>
					<span className="text-sm md:text-base font-medium tracking-[0.3em] text-primary-500/60 uppercase mt-1 font-mono">
						Sparkle
					</span>
				</div>

				{/*
                   副标题区域
                   中文: 寻觅那星之鼓动
                   英文: Searching for the star beat
                */}
				<div className="text-primary-600 font-medium flex items-center justify-center gap-4 w-full">
					<span className="w-8 md:w-12 h-px bg-primary-300 inline-block opacity-70"></span>
					<div className="flex flex-col items-center justify-center text-center">
						<span className="text-lg md:text-xl tracking-wide text-primary-700">
							寻觅那星之鼓动
						</span>
						<span className="text-xs md:text-sm text-primary-400/80 font-normal italic tracking-wide mt-1 font-serif">
							Searching for the star beat
						</span>
					</div>
					<span className="w-8 md:w-12 h-px bg-primary-300 inline-block opacity-70"></span>
				</div>
			</header>

			<InteractiveList
				items={data.items}
				pagination={{
					currentPage: page,
					totalPages,
				}}
				type="note"
				emptyMessage="选择一篇日记查看详情"
			/>
		</main>
	);
}
