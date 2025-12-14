import { HomePage } from "@/components/layouts/HomePage";
import { getNotes, getPosts, getRecently, getUserProfile } from "@/lib/api-client";

/**
 * Homepage - Server Component
 * Fetches data from API and passes to client component
 */
export default async function Page() {
	// Fetch data from backend API
	const [postsResponse, notesResponse, recentlyResponse, profileResponse] = await Promise.all([
		getPosts(1, 5).catch(() => ({ data: { items: [] } })),
		getNotes(1, 5).catch(() => ({ data: { items: [] } })),
		getRecently(5).catch(() => ({ data: { items: [] } })),
		getUserProfile().catch(() => ({
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
		})),
	]);
	return (
		<>
			<HomePage
				profile={profileResponse.data}
				articles={postsResponse.data.items}
				notes={notesResponse.data.items}
				recently={recentlyResponse.data.items}
			/>
		</>
	);
}
