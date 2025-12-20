"use client";

import type { Note, Post, RecentlyWithRendered, User } from "@/types/api";
import { ArticlesSection } from "./home/ArticlesSection";
import { NotesSection } from "./home/NotesSection";
import { ProfileHeader } from "./home/ProfileHeader";
import { RecentlySection } from "./home/RecentlySection";

interface HomePageProps {
	profile: User;
	articles: Post[];
	notes: Note[];
	recently: RecentlyWithRendered[];
}

/**
 * Homepage client component
 * Main entry point for the homepage, receives data from server component
 */
export function HomePage({ profile, articles, notes, recently }: HomePageProps) {
	return (
		<div className="font-sans min-h-screen antialiased transition-colors duration-300 bg-background text-foreground">
			{/* Main Content */}
			<main className="mx-auto px-4 md:px-6 py-16 md:py-20 pb-24 md:pb-32 max-w-[680px] space-y-16 md:space-y-24">
				<ProfileHeader profile={profile} />
				<ArticlesSection articles={articles} />
				<NotesSection notes={notes} />
				<RecentlySection recently={recently} />
			</main>
		</div>
	);
}
