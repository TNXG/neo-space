"use client";

import type { ReactNode } from "react";
import { extractImagesFromMarkdown, parseContainerParams } from "../markdown/plugins/container";
import { Banner } from "./Banner";
import { Gallery } from "./Gallery";
import { GridImages } from "./GridImages";
import { MasonryImages } from "./MasonryImages";

interface ContainerBlockProps {
	type: string;
	params?: string;
	children: ReactNode;
	rawContent?: string;
}

/**
 * ContainerBlock 组件 - 渲染自定义容器
 */
export function ContainerBlock({ type, params = "", children, rawContent = "" }: ContainerBlockProps) {
	// 类型映射
	const typeMap: Record<string, string> = {
		warning: "warn",
		danger: "error",
		note: "info",
	};

	const normalizedType = typeMap[type] || type;

	// Gallery 容器
	if (normalizedType === "gallery") {
		const images = extractImagesFromMarkdown(rawContent);
		return <Gallery images={images} />;
	}

	// Banner 容器（带参数）
	if (normalizedType === "banner" && params) {
		const bannerType = params as "info" | "success" | "warn" | "error";
		return <Banner type={bannerType}>{children}</Banner>;
	}

	// 快捷 Banner 容器
	if (["info", "success", "warn", "error"].includes(normalizedType)) {
		return <Banner type={normalizedType as "info" | "success" | "warn" | "error"}>{children}</Banner>;
	}

	// Grid 容器
	if (normalizedType === "grid") {
		const parsedParams = parseContainerParams(params);
		const cols = Number.parseInt(parsedParams.cols || "2", 10);
		const gap = Number.parseInt(parsedParams.gap || "8", 10);
		const rows = parsedParams.rows ? Number.parseInt(parsedParams.rows, 10) : undefined;
		const gridType = parsedParams.type || "normal";

		if (gridType === "images") {
			const images = extractImagesFromMarkdown(rawContent);
			return <GridImages images={images.map(img => img.url)} cols={cols} gap={gap} rows={rows} />;
		}

		// Normal grid - 渲染子内容
		return (
			<div
				className="relative grid w-full my-6"
				style={{
					gridTemplateColumns: cols ? `repeat(${cols}, minmax(0, 1fr))` : undefined,
					gap: `${gap}px`,
					gridTemplateRows: rows ? `repeat(${rows}, minmax(0, 1fr))` : undefined,
				}}
			>
				{children}
			</div>
		);
	}

	// Masonry 容器
	if (normalizedType === "masonry") {
		const parsedParams = parseContainerParams(params);
		const gap = Number.parseInt(parsedParams.gap || "8", 10);
		const images = extractImagesFromMarkdown(rawContent);
		return <MasonryImages images={images.map(img => img.url)} gap={gap} />;
	}

	// 默认渲染
	return <div className="my-6">{children}</div>;
}
