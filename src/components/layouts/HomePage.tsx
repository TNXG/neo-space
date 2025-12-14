"use client";

import type { Note, Post, Recently, User } from "@/types/api";
import { FloatingNav } from "@/components/common/navigation/FloatingNav";
import { ArticlesSection } from "./home/ArticlesSection";
import { Footer } from "./home/Footer";
import { NotesSection } from "./home/NotesSection";
import { ProfileHeader } from "./home/ProfileHeader";
import { RecentlySection } from "./home/RecentlySection";

interface HomePageProps {
	profile: User;
	articles: Post[];
	notes: Note[];
	recently: Recently[];
}

/**
 * Homepage client component
 * Main entry point for the homepage, receives data from server component
 */
export function HomePage({ profile, articles, notes, recently }: HomePageProps) {
	return (
		<div className="font-sans min-h-screen antialiased transition-colors duration-300 bg-neutral-50 text-primary-900">
			{/* Floating Navigation */}
			<FloatingNav user={profile} />

			{/* Main Content */}
			<main className="mx-auto px-6 py-20 pb-32 max-w-[680px] space-y-24 md:py-32">
				<ProfileHeader profile={profile} />
				<ArticlesSection articles={articles} />
				<NotesSection notes={notes} />
				<RecentlySection recently={recently} />
				<Footer user={profile} />
			</main>
		</div>
	);
}
