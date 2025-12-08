"use client";

import { icons as mingcuteIcons } from "@iconify-json/mingcute";
import { addCollection, Icon } from "@iconify/react/offline";

addCollection(mingcuteIcons);

interface IconProps {
	className?: string;
}

// 导出常用图标组件
export function IconBook({ className }: IconProps) {
	return <Icon icon="mingcute:book-2-line" className={className} />;
}

export function IconCamera({ className }: IconProps) {
	return <Icon icon="mingcute:camera-line" className={className} />;
}

export function IconActivity({ className }: IconProps) {
	return <Icon icon="mingcute:chart-line-line" className={className} />;
}

export function IconArrowUp({ className }: IconProps) {
	return <Icon icon="mingcute:arrow-up-line" className={className} />;
}

export function IconArrowRight({ className }: IconProps) {
	return <Icon icon="mingcute:arrow-right-line" className={className} />;
}

export function IconLayers({ className }: IconProps) {
	return <Icon icon="mingcute:layers-line" className={className} />;
}

export function IconSearch({ className }: IconProps) {
	return <Icon icon="mingcute:search-line" className={className} />;
}

export function IconClock({ className }: IconProps) {
	return <Icon icon="mingcute:time-line" className={className} />;
}

export function IconHome({ className }: IconProps) {
	return <Icon icon="mingcute:home-3-fill" className={className} />;
}

export function IconFriends({ className }: IconProps) {
	return <Icon icon="mingcute:user-3-fill" className={className} />;
}

// 主题图标
export function IconSun({ className }: IconProps) {
	return <Icon icon="mingcute:sun-line" className={className} />;
}

export function IconMoon({ className }: IconProps) {
	return <Icon icon="mingcute:moon-line" className={className} />;
}

export function IconComputer({ className }: IconProps) {
	return <Icon icon="mingcute:computer-line" className={className} />;
}
