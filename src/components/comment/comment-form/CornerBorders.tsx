"use client";

/**
 * 四角点线动画边框组件
 */
export function CornerBorders() {
	return (
		<>
			<span className="absolute z-10 top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-tl-sm" />
			<span className="absolute z-10 top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-tr-sm" />
			<span className="absolute z-10 bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-bl-sm" />
			<span className="absolute z-10 bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-border/60 transition-all duration-500 ease-out group-focus-within:w-1/2 group-focus-within:h-1/2 group-focus-within:border-accent-500 pointer-events-none rounded-br-sm" />
		</>
	);
}
