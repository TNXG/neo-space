/**
 * 正文排版类名单一来源：公共站 MarkdownRenderer 与后台所见即所得编辑器共用，
 * 修改此处即可同时影响两端，避免两套样式漂移。
 */
export const PROSE_CLASSES = {
  h1: "scroll-mt-20 md:scroll-mt-24 text-2xl md:text-4xl font-extrabold tracking-tight text-primary-900 mt-8 md:mt-10 mb-5 md:mb-6 first:mt-0 wrap-break-word",
  h2: "scroll-mt-20 md:scroll-mt-24 text-xl md:text-3xl font-bold tracking-tight text-primary-900 mt-10 md:mt-12 mb-4 md:mb-5 pb-2 border-b border-primary-200/50 wrap-break-word",
  h3: "scroll-mt-20 md:scroll-mt-24 text-lg md:text-2xl font-semibold text-primary-800 mt-6 md:mt-8 mb-3 md:mb-4 wrap-break-word",
  h4: "scroll-mt-20 md:scroll-mt-24 text-base md:text-xl font-semibold text-primary-800 mt-5 md:mt-6 mb-2.5 md:mb-3 wrap-break-word",
  link: "inline-flex flex-wrap items-center gap-0.5 font-medium text-accent-600 hover:text-accent-700 transition-colors cursor-pointer wrap-anywhere",
  ul: "list-disc list-outside ml-5 md:ml-6 mb-5 md:mb-6 space-y-1.5 md:space-y-2 text-primary-700 marker:text-accent-500/70",
  ol: "list-decimal list-outside ml-5 md:ml-6 mb-5 md:mb-6 space-y-1.5 md:space-y-2 text-primary-700 marker:text-accent-500 font-medium",
  li: "leading-relaxed pl-1 wrap-break-word",
  blockquote: "relative my-6 md:my-8 pl-4 md:pl-6 py-3 md:py-4 pr-3 md:pr-4 border-l-4 border-accent-500 rounded-r-2xl bg-surface-100/50 backdrop-blur-sm italic text-primary-600 shadow-sm wrap-break-word w-full",
  inlineCode: "px-1.5 py-0.5 mx-0.5 rounded text-[0.85em] font-mono align-middle bg-neutral-100 border border-neutral-300 text-neutral-800 whitespace-nowrap",
  tableWrapper: "my-6 md:my-8 w-full overflow-x-auto rounded-xl border border-primary-200 shadow-sm scrollbar-thin",
  table: "min-w-full divide-y divide-primary-200 text-left text-xs md:text-sm",
  th: "px-3 md:px-4 py-2 md:py-3 text-left font-medium tracking-wider whitespace-nowrap bg-primary-50 text-primary-900",
  td: "px-3 md:px-4 py-2 md:py-3 text-primary-700 align-top whitespace-normal leading-relaxed min-w-30",
  p: "text-[15px] md:text-lg leading-relaxed text-primary-700 mb-5 md:mb-6 last:mb-0 wrap-break-word",
  image: "relative max-w-full overflow-hidden rounded-xl border border-primary-200 shadow-sm mx-auto my-8",
} as const;
