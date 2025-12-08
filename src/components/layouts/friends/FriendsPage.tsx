"use client";

import { SectionHeader } from "@/components/common";
import { FriendCard } from "./FriendCard";

export function FriendsPage() {
	return (
		<div className="mx-auto max-w-4xl animate-fade-in-up">
			<SectionHeader title="Friends & Links" jpTitle="ゆうじん" />
			<div className="mt-8 gap-4 grid grid-cols-1 md:grid-cols-3 sm:grid-cols-2">
				<FriendCard
					name="Sarah Doe"
					role="UX Designer"
					avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
					url="#"
				/>
				<FriendCard
					name="John Smith"
					role="Frontend Dev"
					avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=John"
					url="#"
				/>
				<FriendCard
					name="Yuki Tanaka"
					role="Illustrator"
					avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Yuki"
					url="#"
				/>
				<FriendCard
					name="Mike Ross"
					role="Product Mgr"
					avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Mike"
					url="#"
				/>
				<FriendCard
					name="Emma Watson"
					role="Writer"
					avatar="https://api.dicebear.com/7.x/avataaars/svg?seed=Emma"
					url="#"
				/>
			</div>

			<div className="mt-12 p-6 text-center border border-(--border-color dashed) rounded-xl">
				<p className="text---text-sub text-(sm) mb-2">Want to be friends?</p>
				<button type="button" className="text---accent text-(xs) font-bold hover:underline">
					Apply for Link Exchange
				</button>
			</div>
		</div>
	);
}
