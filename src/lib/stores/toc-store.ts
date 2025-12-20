import type { TOCItem } from "@/lib/toc";
import { create } from "zustand";

interface TOCState {
	activeId: string;
	items: TOCItem[];
	isAutoScrollEnabled: boolean;
	setActiveId: (id: string) => void;
	setItems: (items: TOCItem[]) => void;
	setAutoScrollEnabled: (enabled: boolean) => void;
	scrollToCenter: (id: string) => void;
}

export const useTOCStore = create<TOCState>(set => ({
	activeId: "",
	items: [],
	isAutoScrollEnabled: true,
	setActiveId: (id: string) => set({ activeId: id }),
	setItems: (items: TOCItem[]) => set({ items }),
	setAutoScrollEnabled: (enabled: boolean) => set({ isAutoScrollEnabled: enabled }),
	scrollToCenter: (id: string) => {
		set({ activeId: id });
		const element = document.getElementById(id);
		if (element) {
			const rect = element.getBoundingClientRect();
			const offsetTop = rect.top + window.scrollY;
			const targetY = offsetTop - (window.innerHeight / 2) + (rect.height / 2);
			window.scrollTo({ top: targetY, behavior: "smooth" });
		}
	},
}));
