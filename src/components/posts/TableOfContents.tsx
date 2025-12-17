"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TOCItem } from "@/lib/toc";

interface TableOfContentsProps {
	toc: TOCItem[];
	className?: string;
}

export function TableOfContents({ toc, className }: TableOfContentsProps) {
	const [activeId, setActiveId] = useState<string>("");
	const navRef = useRef<HTMLElement>(null);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						setActiveId(entry.target.id);
					}
				});
			},
			{
				rootMargin: "-10% 0px -80% 0px",
			},
		);

		toc.forEach((item) => {
			const element = document.getElementById(item.id);
			if (element) {
				observer.observe(element);
			}
		});

		return () => observer.disconnect();
	}, [toc]);

	// Auto-scroll active item into view
	useEffect(() => {
		if (activeId && navRef.current) {
			const activeLink = navRef.current.querySelector<HTMLAnchorElement>(`a[href="#${activeId}"]`);
			if (activeLink) {
				// Scroll the nav container, not the window
				const navContainer = navRef.current.querySelector("ul");
				if (navContainer) {
					const containerRect = navContainer.getBoundingClientRect();
					const linkRect = activeLink.getBoundingClientRect();
					
					// If link is outside visible area of container (with some buffer)
					if (linkRect.top < containerRect.top + 20 || linkRect.bottom > containerRect.bottom - 20) {
						activeLink.scrollIntoView({
							behavior: "smooth",
							block: "center",
						});
					}
				}
			}
		}
	}, [activeId]);

	if (!toc.length)
		return null;

	return (
		<nav 
			ref={navRef}
			className={cn(
				"relative",
				className
			)}
		>
			<h3 className="font-semibold text-primary-900 dark:text-primary-100 mb-4 px-2 tracking-tight">
				目录
			</h3>
			
			<div className="relative group">
				{/* Scrollable Container with max-height */}
				<ul 
					className="space-y-1 max-h-[65vh] overflow-y-auto pr-2 toc-scrollbar pb-8"
				>
					{toc.map(item => (
						<li
							key={item.id}
							style={{ paddingLeft: `${(item.depth - 2) * 12}px` }}
						>
							<a
								href={`#${item.id}`}
								onClick={(e) => {
									e.preventDefault();
									const target = document.getElementById(item.id);
									if (target) {
										// Offset for sticky headers if mostly needed, but pure scrollIntoView is usually fine
										const headerOffset = 100;
										const elementPosition = target.getBoundingClientRect().top;
										const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
										
										window.scrollTo({
											top: offsetPosition,
											behavior: "smooth"
										});
									}
									setActiveId(item.id);
								}}
								className={cn(
									"block py-1.5 px-3 rounded-full text-sm transition-all duration-300 cursor-pointer border border-transparent",
									activeId === item.id
										? "bg-primary-100/80 dark:bg-primary-800/60 text-accent-600 dark:text-accent-400 font-medium shadow-sm border-primary-200/50 dark:border-primary-700/50 backdrop-blur-sm"
										: "text-primary-600 dark:text-primary-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-primary-900 dark:hover:text-primary-200 hover:scale-[1.02]",
								)}
							>
								{item.title}
							</a>
						</li>
					))}
				</ul>
				
				{/* Bottom Gradient Fade Mask */}
				<div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white dark:from-[#121212] to-transparent pointer-events-none transition-opacity duration-300 group-hover:opacity-0" />
			</div>
		</nav>
	);
}
