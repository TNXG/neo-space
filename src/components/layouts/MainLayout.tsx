"use client";

import type { ReactNode } from "react";
import { useUI } from "@/lib/hooks/useUI";
import { BottomBar } from "./BottomBar";
import { Drawer } from "./Drawer";
import { NavBar } from "./NavBar";

export function MainLayout({ children }: { children: ReactNode }) {
	const ui = useUI();

	return (
		<div className="bg-(--bg-primary) min-h-screen relative">
			<NavBar />

			<main
				className={`origin-center transition-all duration-300 relative z-10 ${
					ui.drawerOpen ? "scale-[0.98] opacity-60 blur-[1px] pointer-events-none" : "scale-100 opacity-100"
				}`}
			>
				<div className="mx-auto px-4 pb-32 pt-24 max-w-7xl md:px-8">{children}</div>
			</main>

			<BottomBar />
			<Drawer />
		</div>
	);
}
