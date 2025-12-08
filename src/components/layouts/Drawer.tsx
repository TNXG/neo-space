"use client";

import { useEffect } from "react";
import { IconArrowRight } from "@/components/icons";
import { useUI } from "@/lib/hooks/useUI";

export const Drawer = () => {
	const ui = useUI();

	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				ui.closeDrawer();
			}
		};

		window.addEventListener("keydown", handleEscape);
		return () => {
			window.removeEventListener("keydown", handleEscape);
		};
	}, [ui]);

	return (
		<>
			<div
				className={`bg-black/40 transition-opacity duration-300 inset-0 fixed z-50 backdrop-blur-sm ${
					ui.drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
				}`}
				onClick={ui.closeDrawer}
			/>
			<div
				className={`bg---bg-primary flex flex-col h-full w-full shadow-2xl transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] right-0 top-0 fixed z-50 md:w-[600px] ${
					ui.drawerOpen ? "translate-x-0" : "translate-x-full"
				}`}
			>
				<div className="p-6 border-(--border-color b) flex items-center justify-between">
					<span className="text---text-sub text-(xs) tracking-widest font-bold uppercase">Preview</span>
					<button
						type="button"
						onClick={ui.closeDrawer}
						className="text---text-main hover:bg---bg-card-hover p-2 rounded-full cursor-pointer"
					>
						<IconArrowRight className="h-5 w-5" />
					</button>
				</div>
				<div className="p-6 flex-1 overflow-y-auto md:p-10">
					{ui.drawerContent}
				</div>
			</div>
		</>
	);
};

export default Drawer;
