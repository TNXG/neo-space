interface ImageFigureProps {
	src?: string;
	alt?: string;
}

export function ImageFigure({ src, alt }: ImageFigureProps) {
	return (
		<figure className="my-8 flex flex-col items-center">
			<img
				src={src}
				alt={alt}
				className="rounded-2xl border border-primary-200 dark:border-primary-800 shadow-md dark:shadow-black/30 w-full h-auto max-h-[800px] object-cover bg-primary-50 dark:bg-primary-900"
				loading="lazy"
			/>
			{alt && (
				<figcaption className="mt-3 text-sm text-center text-primary-500 italic">
					{alt}
				</figcaption>
			)}
		</figure>
	);
}
