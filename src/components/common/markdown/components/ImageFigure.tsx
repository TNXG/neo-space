"use client";

interface ImageFigureProps {
	src: string;
	alt?: string;
}

export function ImageFigure({ src, alt }: ImageFigureProps) {
	return (
		<figure className="my-8 flex flex-col items-center gap-3">
			<div className="w-full overflow-hidden rounded-2xl border border-primary-200 bg-primary-50 shadow-md">
				<img
					src={src}
					alt={alt}
					className="h-auto w-full max-h-[800px] object-cover"
					loading="lazy"
				/>
			</div>
			{alt ? (
				<figcaption className="text-center text-sm text-primary-500">
					{alt}
				</figcaption>
			) : null}
		</figure>
	);
}
