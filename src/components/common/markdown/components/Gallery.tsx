"use client";

import { clsx } from "clsx";
import { useState } from "react";

interface GalleryImage {
	url: string;
	alt?: string;
}

interface GalleryProps {
	images: GalleryImage[];
	className?: string;
}

/**
 * Gallery 组件 - 图片画廊展示
 */
export function Gallery({ images, className }: GalleryProps) {
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

	if (images.length === 0) {
		return null;
	}

	const handleClose = () => setSelectedIndex(null);
	const handlePrev = () => {
		if (selectedIndex !== null) {
			setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
		}
	};
	const handleNext = () => {
		if (selectedIndex !== null) {
			setSelectedIndex((selectedIndex + 1) % images.length);
		}
	};

	return (
		<>
			<div className={clsx("my-8 grid gap-4", className)}>
				<div
					className={clsx(
						"grid gap-4",
						images.length === 1 && "grid-cols-1",
						images.length === 2 && "grid-cols-2",
						images.length >= 3 && "grid-cols-2 md:grid-cols-3",
					)}
				>
					{images.map((image, idx) => (
						<button
							key={image.url}
							type="button"
							onClick={() => setSelectedIndex(idx)}
							className="relative aspect-video overflow-hidden rounded-xl bg-surface-100 cursor-pointer group"
						>
							<img
								src={image.url}
								alt={image.alt || `Gallery image ${idx + 1}`}
								className="object-cover transition-transform duration-300 group-hover:scale-105"
								sizes="(max-width: 768px) 50vw, 33vw"
							/>
							<div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
						</button>
					))}
				</div>
			</div>

			{/* Lightbox */}
			{selectedIndex !== null && (
				<div
					className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
					onClick={handleClose}
				>
					<button
						type="button"
						onClick={handleClose}
						className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors cursor-pointer"
						aria-label="Close"
					>
						<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>

					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handlePrev();
						}}
						className="absolute left-4 text-white/80 hover:text-white transition-colors cursor-pointer"
						aria-label="Previous"
					>
						<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
						</svg>
					</button>

					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handleNext();
						}}
						className="absolute right-4 text-white/80 hover:text-white transition-colors cursor-pointer"
						aria-label="Next"
					>
						<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
						</svg>
					</button>

					<div className="relative max-w-6xl max-h-[90vh] w-full h-full" onClick={e => e.stopPropagation()}>
						<img
							src={images[selectedIndex].url}
							alt={images[selectedIndex].alt || `Gallery image ${selectedIndex + 1}`}
							className="object-contain"
							sizes="90vw"
						/>
					</div>
				</div>
			)}
		</>
	);
}
