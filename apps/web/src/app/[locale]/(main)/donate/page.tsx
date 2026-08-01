import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/common/PageHero";
import { DonateQrCode } from "@/components/layouts/donate/DonateQrCode";
import { Icon } from "@/lib/inline-icon";

interface DonatePageProps {
  params: Promise<{ locale: string }>;
}

const NOTICE_ITEM_KEYS = [
  "donate.notice.item1",
  "donate.notice.item2",
] as const;

export async function generateMetadata({
  params,
}: DonatePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("donate.meta.title"),
    description: t("donate.meta.description"),
  };
}

export const revalidate = 57600;
export const dynamicParams = true;

export default async function DonatePage() {
  const t = await getTranslations();

  const alipayQR = "https://qr.alipay.com/fkx17201j5itwylatiln462";
  const wechatQR = "wxp://f2f0EvlhUDqIOEL6FyPXud-DfXfYAeZ0gEnzilXbBxdUuPY";

  return (
    <main className="container mx-auto px-4 md:px-6 py-12 md:py-16 max-w-5xl relative min-h-[80vh]">
      <PageHero
        title={t("donate.title")}
        eyebrow={t("donate.eyebrow")}
        subtitle={t("donate.subtitle")}
        subtitleAlt={t("donate.subtitleAlt")}
      />

      <div className="mt-16 md:mt-24 lg:mt-32 pb-24 relative">
        {/* Thin crosshairs mapping the space implicitly */}
        <div className="hidden lg:block absolute left-1/3 top-0 bottom-0 w-px bg-border/30" />
        <div className="hidden lg:block absolute left-2/3 top-0 bottom-0 w-px bg-border/30" />

        {/* Staggered Layout Matrix */}
        <div className="flex flex-col gap-16 lg:grid lg:grid-cols-3 lg:gap-16">
          {/* WECHAT (Placed slightly lower) */}
          <section className="col-span-1 flex flex-col items-center lg:items-start gap-6 lg:gap-8 lg:mt-16 relative group lg:pl-10 text-center lg:text-left">
            {/* Small decorative plus at the top left corner */}
            <Icon
              icon="mingcute:add-line"
              className="hidden lg:block absolute -top-[1.2rem] -left-[1.2rem] text-muted-foreground/30 text-xl"
            />

            <div className="flex flex-col items-center gap-3 lg:items-start">
              <h2 className="text-sm font-semibold tracking-widest text-foreground uppercase flex items-center justify-center lg:justify-start gap-2">
                <Icon
                  icon="mingcute:wechat-pay-line"
                  className="text-xl text-primary"
                />
                {t("donate.method.wechat")}
              </h2>
              <div className="h-px w-8 bg-primary/40" />
            </div>

            <div className="w-fit rounded-3xl border border-border bg-primary-foreground p-3.5 ring-1 ring-border ring-offset-8 ring-offset-background transition-colors duration-300 group-hover:ring-primary/30">
              <DonateQrCode
                title={t("donate.method.wechat")}
                value={wechatQR}
              />
            </div>
            <p className="text-xs text-muted-foreground/40 tracking-widest font-mono">
              SYS_CODE/WX_01
            </p>
          </section>

          {/* ALIPAY (Placed higher up) */}
          <section className="col-span-1 flex flex-col items-center lg:items-start gap-6 lg:gap-8 relative group lg:-mt-4 lg:pl-10 text-center lg:text-left">
            <Icon
              icon="mingcute:add-line"
              className="hidden lg:block absolute -top-[1.2rem] -left-[1.2rem] text-muted-foreground/30 text-xl"
            />

            <div className="flex flex-col items-center gap-3 lg:items-start">
              <h2 className="text-sm font-semibold tracking-widest text-foreground uppercase flex items-center justify-center lg:justify-start gap-2">
                <Icon
                  icon="mingcute:alipay-line"
                  className="text-xl text-primary"
                />
                {t("donate.method.alipay")}
              </h2>
              <div className="h-px w-8 bg-primary/40" />
            </div>

            <div className="w-fit rounded-3xl border border-border bg-primary-foreground p-3.5 ring-1 ring-border ring-offset-8 ring-offset-background transition-colors duration-300 group-hover:ring-primary/30">
              <DonateQrCode
                title={t("donate.method.alipay")}
                value={alipayQR}
              />
            </div>
            <p className="text-xs text-muted-foreground/40 tracking-widest font-mono">
              SYS_CODE/ALY_02
            </p>
          </section>

          {/* AFDIAN & NOTICE (Aligned right, vertical stack, placed lower than ALIPAY) */}
          <section className="col-span-1 flex flex-col gap-12 lg:gap-16 lg:mt-32 relative lg:pl-10">
            <Icon
              icon="mingcute:add-line"
              className="hidden lg:block absolute -top-[1.2rem] -left-[1.2rem] text-muted-foreground/30 text-xl"
            />

            {/* Afdian Block */}
            <div className="flex flex-col items-center lg:items-start gap-4 border-l-0 lg:border-l-2 border-primary/20 lg:pl-6 text-center lg:text-left">
              <h2 className="text-sm font-semibold tracking-widest text-foreground uppercase flex items-center justify-center lg:justify-start gap-2">
                <Icon
                  icon="simple-icons:afdian"
                  className="text-[1.2em] text-primary"
                />
                {t("donate.method.afdian")}
              </h2>
              <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-xs">
                {t("donate.method.afdianHint")}
              </p>
              <a
                href="https://afdian.com/a/tianxiang"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex w-fit cursor-pointer items-center justify-center gap-1 text-sm font-medium text-foreground transition-colors hover:text-primary lg:justify-start"
              >
                {t("donate.method.afdianAction")}
                <Icon icon="mingcute:arrow-right-up-line" />
              </a>
            </div>

            {/* Notice Block */}
            <div className="flex flex-col items-center lg:items-start gap-5 border-l-0 lg:border-l-2 border-border/30 lg:pl-6">
              <h3 className="text-[0.8rem] font-semibold tracking-widest text-foreground uppercase">
                {t("donate.notice.title")}
              </h3>
              <ul className="flex max-w-sm flex-col gap-4">
                {NOTICE_ITEM_KEYS.map((noticeItemKey, index) => (
                  <li
                    key={noticeItemKey}
                    className="text-sm text-muted-foreground/80 leading-relaxed font-light relative pl-4 lg:pl-2 text-left"
                  >
                    <span className="font-mono text-[0.7rem] font-semibold text-muted-foreground/30 absolute left-0 lg:-left-5 top-0.5">
                      0{index + 1}
                    </span>
                    {t(noticeItemKey)}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
