import { Icon } from "@/lib/inline-icon";

interface BangumiUnavailableProps {
  title: string;
  description: string;
}

/** 展示配置缺失或远端暂不可用时的稳定降级状态。 */
export function BangumiUnavailable({ title, description }: BangumiUnavailableProps) {
  return (
    <section className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-card/25 px-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <Icon icon="mingcute:planet-line" className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-[1.65] text-muted-foreground">{description}</p>
    </section>
  );
}
