"use client";

import { clsx } from "clsx";

interface GridImagesProps {
	images: string[];
	cols?: number;
	gap?: number;
	rows?: number;
	className?: string;
}

/**
 * GridImages 组件 - 网格布局图片展示
 */
export function GridImages({ images, cols = 2, gap = 8, rows, className }: GridImagesProps) {
	if (images.length === 0) {
		return null;
	}

	return (
		<div
			className={clsx("relative grid w-full my-6", className)}
			style={{
				gridTemplateColumns: cols ? `repeat(${cols}, minmax(0, 1fr))` : undefined,
				gap: `${gap}px`,
				gridTemplateRows: rows ? `repeat(${rows}, minmax(0, 1fr))` : undefined,
			}}
		>
			{images.map((src, idx) => (
				<div key={src} className="relative aspect-video overflow-hidden rounded-xl bg-surface-100">
					<img
						src={src}
						alt={`Grid image ${idx + 1}`}
						className="object-cover"
						sizes={`${100 / cols}vw`}
					/>
				</div>
			))}
		</div>
	);
}
