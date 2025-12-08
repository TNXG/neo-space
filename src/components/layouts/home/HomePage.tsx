"use client";

import type { ReactElement, SVGProps } from "react";
import { useState } from "react";
import { SectionHeader } from "@/components/common";

import { IconActivity, IconBook, IconCamera } from "@/components/icons";
import { GlassCard } from "@/components/ui";
import { useUI } from "@/lib/hooks/useUI";
import { ArticleCard } from "./ArticleCard";
import { DiaryItem } from "./DiaryItem";
import { MomentCard } from "./MomentCard";

type TabId = "overview" | "writing" | "diary";

interface Tab {
	id: TabId;
	label: string;
	icon: (props: SVGProps<SVGSVGElement>) => ReactElement;
}

export function HomePage() {
	const ui = useUI();
	const [activeTab, setActiveTab] = useState<TabId>("overview");

	const tabs: Tab[] = [
		{ id: "overview", label: "Overview", icon: IconActivity },
		{ id: "writing", label: "Writing", icon: IconBook },
		{ id: "diary", label: "Life Log", icon: IconCamera },
	];

	const handleArticleClick = (title: string) => {
		ui.openDrawer(
			<article className="prose prose-sm md:prose-base dark:prose-invert font-serif max-w-none">
				<h1 className="text-3xl font-bold font-sans mb-2">{title}</h1>
				<div className="text---text-sub text-(xs) font-mono mb-8 pb-4 border-(--border-color b) flex gap-4">
					<span>2023-10-24</span>
					<span>•</span>
					<span>5 min read</span>
				</div>
				<p>Here lies the detailed content of the article. This is a simulation of the reading experience.</p>
				<div className="text---text-sub text-(xs) my-6 rounded-lg bg-gray-100 flex h-48 w-full items-center justify-center dark:bg-gray-800">
					Visual Content
				</div>
				<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit...</p>
			</article>,
		);
	};

	return (
		<div className="mx-auto max-w-4xl">
			{/* Navigation Tabs */}
			<div className="scrollbar-hide pb-6 flex gap-2 items-center justify-center overflow-x-auto md:pb-8">
				{tabs.map((tab) => {
					const isActive = activeTab === tab.id;
					const Icon = tab.icon;
					return (
						<button
							type="button"
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`text-sm font-bold px-4 py-2 rounded-full flex gap-2 whitespace-nowrap transition-all duration-200 items-center ${
								isActive
									? "bg-(--text-main) text-(--bg-primary) shadow-md"
									: "bg-(--bg-card) text-(--text-sub) hover:bg-(--bg-card-hover) hover:text-(--text-main)"
							}`}
						>
							<Icon className="h-3.5 w-3.5" />
							{tab.label}
						</button>
					);
				})}
			</div>
			{" "}
			{/* Tab Panels */}
			<div className="animate-fade-in-up">
				{/* 1. OVERVIEW: A Mix of Everything */}
				{activeTab === "overview" && (
					<div className="space-y-8">
						{/* Moments / Sayings */}
						<section>
							<SectionHeader title="Moments" jpTitle="つぶやき" />
							<div className="flex flex-col gap-4">
								<GlassCard padding="p-4" className="border-l-(--accent 4) from-(--bg-card) to-(--accent-soft) bg-linear-to-r">
									<p className="text---text-main text-(sm) font-medium italic">
										"The best way to predict the future is to create it."
									</p>
								</GlassCard>
								<MomentCard
									content="哦哦哦！ 今天的天空好蓝，心情也跟着晴朗起来了！🌞 #好心情"
									time="2h ago"
									tags={["coding", "design"]}
								/>
								<MomentCard
									content="再生产！这就是歌剧少女的力量！🎭🎶 #音楽 #インスピレーション"
									time="5h ago"
									tags={["movie", "life"]}
								/>
							</div>
						</section>

						{/* Recent Articles Preview */}
						<section>
							<SectionHeader title="Recent Writing" jpTitle="さいしんのきじ" action="View All" />
							<div className="gap-4 grid grid-cols-1 md:grid-cols-2">
								<ArticleCard
									title="The Art of Invisible Design"
									category="Design"
									date="Oct 24"
									readTime="5 min"
									onClick={() => handleArticleClick("The Art of Invisible Design")}
								/>
								<ArticleCard
									title="React Server Components"
									category="Engineering"
									date="Oct 20"
									readTime="8 min"
									onClick={() => handleArticleClick("React Server Components")}
								/>
							</div>
						</section>
					</div>
				)}

				{/* 2. WRITING: Archives */}
				{activeTab === "writing" && (
					<div className="gap-4 grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2">
						{[1, 2, 3, 4, 5, 6].map(i => (
							<ArticleCard
								key={i}
								title={`The Future of Web Development Vol.${i}`}
								category={i % 2 === 0 ? "Tech" : "Essay"}
								date={`Oct ${10 + i}`}
								readTime={`${3 + i} min`}
								onClick={() => handleArticleClick(`The Future of Web Development Vol.${i}`)}
							/>
						))}
					</div>
				)}

				{/* 3. LIFE LOG: Timeline */}
				{activeTab === "diary" && (
					<GlassCard padding="p-8">
						<SectionHeader title="Journal" jpTitle="にっき" />
						<div className="mt-6">
							<DiaryItem
								date="2023.10.25"
								title="Rainy day in Shibuya"
								weather="Rainy"
								mood="Calm"
								content="Spent the whole afternoon in a cafe near the station. The sound of rain against the glass is the best white noise for coding."
							/>
							<DiaryItem
								date="2023.10.22"
								title="New Keyboard Arrived"
								weather="Sunny"
								mood="Excited"
								content="Finally got my hands on the HHKB Professional Hybrid. The tactile feel is unmatched. Productivity +100."
							/>
							<DiaryItem
								date="2023.10.15"
								title="Hiking at Mt. Takao"
								weather="Cloudy"
								mood="Tired"
								content="The autumn leaves are starting to turn red. It was a tough climb but the soba noodles at the top were worth it."
							/>
						</div>
					</GlassCard>
				)}
			</div>
		</div>
	);
}
