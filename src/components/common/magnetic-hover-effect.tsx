"use client";

import React, { useCallback, useRef } from "react";
import { clsxm } from "@/lib/utils";

type MagneticHoverEffectProps<T extends React.ElementType> = {
	as?: T;
	children: React.ReactNode;
	variant?: "default" | "accent";
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "children">;

export const MagneticHoverEffect = <T extends React.ElementType = "div">({
	as,
	children,
	variant = "default",
	className,
	...rest
}: MagneticHoverEffectProps<T>) => {
	const Component = as || "div";
	const itemRef = useRef<any>(null);

	const handleMouseEnter = (e: React.MouseEvent<any>) => {
		if (!itemRef.current)
			return;

		const rect = itemRef.current.getBoundingClientRect();
		const x = ((e.clientX - rect.left) / rect.width) * 100;
		const y = ((e.clientY - rect.top) / rect.height) * 100;

		itemRef.current.style.transition = "transform 0.2s cubic-bezier(0.33, 1, 0.68, 1)";
		itemRef.current.style.setProperty("--origin-x", `${x}%`);
		itemRef.current.style.setProperty("--origin-y", `${y}%`);
	};

	const handleMouseLeave = () => {
		if (!itemRef.current)
			return;
		itemRef.current.style.transform = "translate(0px, 0px)";
		itemRef.current.style.transition = "transform 0.4s cubic-bezier(0.33, 1, 0.68, 1)";
	};

	const handleMouseMove = useCallback((e: React.MouseEvent<any>) => {
		if (!itemRef.current)
			return;
		const rect = itemRef.current.getBoundingClientRect();

		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const distanceX = (e.clientX - centerX) * 0.05;
		const distanceY = (e.clientY - centerY) * 0.05;

		itemRef.current.style.transform = `translate(${distanceX}px, ${distanceY}px)`;
	}, []);

	return (
		<Component
			ref={itemRef}
			onMouseEnter={handleMouseEnter}
			onMouseLeave={handleMouseLeave}
			onMouseMove={handleMouseMove}
			className={clsxm(
				"relative isolate",
				"inline-block transition-all duration-200 ease-out",
				"before:absolute before:-inset-x-2 before:inset-y-0 before:z-[-1] before:scale-[0.92] before:rounded-xl before:opacity-0 before:backdrop-blur-sm before:transition-all before:duration-200 before:origin-[var(--origin-x)_var(--origin-y)] hover:before:scale-100 hover:before:opacity-100",
				variant === "accent" ? "before:bg-primary/10" : "before:bg-muted/80",
				className,
			)}
			{...rest}
		>
			{children}
		</Component>
	);
};

/**
 * 包裹多个 MagneticHoverEffect 组件的容器
 * 在整个容器区域内隐藏鼠标指针，避免组件间隙显示鼠标
 */
interface MagneticZoneProps {
	children: React.ReactNode;
	className?: string;
}

export const MagneticZone = ({ children, className }: MagneticZoneProps) => {
	return (
		<div className={clsxm("cursor-none **:cursor-none", className)}>
			{children}
		</div>
	);
};
