import type { ReactNode } from "react";

interface PageHeroProps {
  title: ReactNode;
  eyebrow: ReactNode;
  subtitle: ReactNode;
  subtitleAlt?: ReactNode;
  className?: string;
}

/**
 * 统一站内列表页头部视觉，避免渐变和副标题色值继续分叉。
 */
export function PageHero({
  title,
  eyebrow,
  subtitle,
  subtitleAlt,
  className,
}: PageHeroProps) {
  const headerClassName = className
    ? `mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center ${className}`
    : "mb-12 md:mb-20 md:text-center max-w-2xl mx-auto flex flex-col items-center";

  return (
    <header className={headerClassName}>
      <div className="mb-4 md:mb-6 flex flex-col items-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-linear-to-r from-primary-800 to-accent-600 bg-clip-text text-transparent leading-tight py-2 select-none">
          {title}
        </h1>
        <span className="text-xs md:text-sm lg:text-base font-medium tracking-[0.3em] text-accent-600/60 uppercase mt-1 font-mono">
          {eyebrow}
        </span>
      </div>

      <div className="text-primary-600 font-medium flex items-center justify-center gap-3 md:gap-4 w-full">
        <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70" />
        <div className="flex flex-col items-center justify-center text-center">
          <span className="text-base md:text-lg lg:text-xl tracking-wide text-primary-700">
            {subtitle}
          </span>
          {subtitleAlt
            ? (
                <span className="text-[11px] md:text-xs lg:text-sm text-primary-500/75 font-normal italic tracking-wide mt-0.5 md:mt-1 font-serif">
                  {subtitleAlt}
                </span>
              )
            : null}
        </div>
        <span className="w-6 md:w-8 lg:w-12 h-px bg-accent-300 inline-block opacity-70" />
      </div>
    </header>
  );
}
