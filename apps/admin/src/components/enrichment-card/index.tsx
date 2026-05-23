import type { PropType } from "vue";
import type { EnrichmentAttribute, EnrichmentResult } from "~/models/enrichment";
import {
  AlertTriangle as AlertIcon,
  ExternalLink as ExternalLinkIcon,
  Loader2 as LoaderIcon,
  RefreshCw as RefreshIcon,
} from "lucide-vue-next";
import { NButton } from "naive-ui";
import { computed, defineComponent } from "vue";

export const EnrichmentCard = defineComponent({
  name: "EnrichmentCard",
  props: {
    enrichment: {
      type: Object as PropType<EnrichmentResult | null | undefined>,
      default: null,
    },
    /** Optional external id (for showing failure-retry button) */
    provider: String,
    externalId: String,
    /** Whether the row had an enrichment ref but resolution failed */
    failed: { type: Boolean, default: false },
    onRetry: Function as PropType<() => void>,
    retrying: { type: Boolean, default: false },
  },
  setup(props) {
    return () => {
      if (props.failed && !props.enrichment) {
        return <FailureCard onRetry={props.onRetry} retrying={props.retrying} />;
      }
      const e = props.enrichment;
      if (!e)
        return null;

      switch (e.category) {
        case "github":
          return <GithubCard enrichment={e} />;
        case "media":
          return <MediaCard enrichment={e} />;
        case "book":
          return <BookCard enrichment={e} />;
        case "music":
          return <MusicCard enrichment={e} />;
        case "academic":
          return <AcademicCard enrichment={e} />;
        case "code":
          return <CodeCard enrichment={e} />;
        case "self":
          return <SelfCard enrichment={e} />;
        default:
          return <FallbackCard enrichment={e} />;
      }
    };
  },
});

// ======================== Shared utilities ========================

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function formatAttr(a: EnrichmentAttribute): string {
  const v = a.value;
  switch (a.format) {
    case "rating":
      return typeof v === "number" ? `⭐ ${v.toFixed(1)}` : `⭐ ${v}`;
    case "percent":
      return typeof v === "number" ? `${(v * 100).toFixed(1)}%` : `${v}`;
    case "date":
      return typeof v === "string"
        ? new Date(v).toLocaleDateString("zh-CN")
        : String(v);
    case "duration":
      if (typeof v === "number") {
        const m = Math.floor(v / 60);
        const s = Math.floor(v % 60);
        return `${m}:${s.toString().padStart(2, "0")}`;
      }
      return String(v);
    case "number":
      return typeof v === "number" ? v.toLocaleString() : String(v);
    default:
      return String(v);
  }
}

const categoryColorFallback: Record<string, string> = {
  github: "#24292f",
  media: "#01b4e4",
  book: "#8b6f4e",
  music: "#c20c0c",
  academic: "#b31b1b",
  code: "#ffa116",
  self: "#3b82f6",
};

function colorFor(e: EnrichmentResult): string {
  return e.color || categoryColorFallback[e.category] || "#737373";
}

// ======================== Shell components ========================

const ColorBarShell = defineComponent({
  props: {
    color: { type: String, required: true },
    href: String,
  },
  setup(props, { slots }) {
    return () => {
      const inner = (
        <div class="px-3 py-2.5 flex gap-3">
          <div
            class="rounded-full shrink-0 w-1"
            style={{ backgroundColor: props.color }}
          />
          <div class="flex-1 min-w-0">{slots.default?.()}</div>
        </div>
      );
      return <CardWrap href={props.href}>{inner}</CardWrap>;
    };
  },
});

const ImageShell = defineComponent({
  props: {
    href: String,
  },
  setup(_, { slots }) {
    return () => (
      <CardWrap href={_.href}>
        <div class="p-3 flex gap-3">{slots.default?.()}</div>
      </CardWrap>
    );
  },
});

const CardWrap = defineComponent({
  props: { href: String },
  setup(props, { slots }) {
    return () => {
      const cls
        = "border border-neutral-200 rounded-lg bg-white block transition-colors overflow-hidden dark:border-neutral-800 dark:bg-neutral-900";
      const hover
        = "hover:border-neutral-300 hover:bg-neutral-50 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/60";
      if (props.href) {
        return (
          <a
            href={props.href}
            target="_blank"
            rel="noopener noreferrer"
            class={[cls, hover, "no-underline"]}
          >
            {slots.default?.()}
          </a>
        );
      }
      return <div class={cls}>{slots.default?.()}</div>;
    };
  },
});

const LinkFooter = defineComponent({
  props: {
    url: { type: String, required: true },
    self: { type: Boolean, default: false },
  },
  setup(props) {
    return () => (
      <div class="text-xs text-neutral-400 mt-1.5 inline-flex gap-1 items-center">
        <ExternalLinkIcon class="size-3" aria-hidden="true" />
        <span class="truncate">
          {props.self ? pathOf(props.url) : hostnameOf(props.url)}
        </span>
      </div>
    );
  },
});

const Title = defineComponent({
  props: {
    children: String,
    mono: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => (
      <h4
        class={[
          "truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100",
          props.mono ? "font-mono" : "",
        ]}
      >
        {slots.default?.() ?? props.children}
      </h4>
    );
  },
});

// ======================== Per-category cards ========================

const GithubCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    const subtype = computed(() => props.enrichment.subtype);
    const stateAttr = computed(() =>
      props.enrichment.attributes?.find(a => a.key === "state"),
    );
    const stateColor = computed(() => {
      const v = String(stateAttr.value?.value ?? "").toUpperCase();
      if (v === "OPEN")
        return "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400";
      if (v === "CLOSED")
        return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
      if (v === "MERGED")
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400";
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    });

    return () => {
      const e = props.enrichment;
      const subtypeLabel = subtype.value ? subtype.value.toUpperCase() : "REPO";
      return (
        <ColorBarShell color={colorFor(e)} href={e.url}>
          <div class="flex gap-1.5 items-center">
            {stateAttr.value
              ? (
                  <span
                    class={[
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                      stateColor.value,
                    ]}
                  >
                    {String(stateAttr.value.value).toUpperCase()}
                  </span>
                )
              : (
                  <span class="text-[10px] text-neutral-700 font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800">
                    {subtypeLabel}
                  </span>
                )}
            <Title mono>{e.title}</Title>
          </div>
          {e.description && (
            <p class="text-xs text-neutral-500 mt-1 line-clamp-2 dark:text-neutral-400">
              {e.description}
            </p>
          )}
          <AttributeRow attrs={e.attributes} exclude={["state"]} limit={4} />
          <LinkFooter url={e.url} />
        </ColorBarShell>
      );
    };
  },
});

const MediaCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    return () => {
      const e = props.enrichment;
      return (
        <ImageShell href={e.url}>
          {e.image && (
            <img
              src={e.image.url}
              alt={e.image.alt || e.title}
              class="rounded shrink-0 h-[120px] w-[80px] object-cover"
              loading="lazy"
            />
          )}
          <div class="flex-1 min-w-0">
            <Title>{e.title}</Title>
            {e.description && (
              <p class="text-xs text-neutral-500 mt-1 line-clamp-2 dark:text-neutral-400">
                {e.description}
              </p>
            )}
            <AttributeRow attrs={e.attributes} limit={4} />
            <LinkFooter url={e.url} />
          </div>
        </ImageShell>
      );
    };
  },
});

const BookCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    return () => {
      const e = props.enrichment;
      return (
        <ImageShell href={e.url}>
          {e.image && (
            <img
              src={e.image.url}
              alt={e.image.alt || e.title}
              class="rounded shrink-0 h-[80px] w-[60px] object-cover"
              loading="lazy"
            />
          )}
          <div class="flex-1 min-w-0">
            <Title>{e.title}</Title>
            <AttributeRow attrs={e.attributes} limit={4} />
            <LinkFooter url={e.url} />
          </div>
        </ImageShell>
      );
    };
  },
});

const MusicCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    return () => {
      const e = props.enrichment;
      return (
        <ImageShell href={e.url}>
          {e.image && (
            <img
              src={e.image.url}
              alt={e.image.alt || e.title}
              class="rounded shrink-0 size-[72px] object-cover"
              loading="lazy"
            />
          )}
          <div class="flex-1 min-w-0">
            <div class="flex gap-1.5 items-center">
              <span class="text-neutral-500">▶</span>
              <Title>{e.title}</Title>
            </div>
            <AttributeRow attrs={e.attributes} limit={3} />
            <LinkFooter url={e.url} />
          </div>
        </ImageShell>
      );
    };
  },
});

const AcademicCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    return () => {
      const e = props.enrichment;
      const arxivId = e.attributes?.find(a => a.key === "arxivId");
      return (
        <ColorBarShell color={colorFor(e)} href={e.url}>
          <div class="flex gap-1.5 items-center">
            <span class="text-neutral-500">📄</span>
            {arxivId && (
              <span class="text-[10px] text-red-700 font-mono font-semibold px-1.5 py-0.5 rounded bg-red-50 dark:text-red-400 dark:bg-red-950/50">
                arXiv:
                {arxivId.value}
              </span>
            )}
          </div>
          <div class="mt-1">
            <Title>{e.title}</Title>
          </div>
          <AttributeRow attrs={e.attributes} exclude={["arxivId"]} limit={2} />
          {e.description && (
            <p class="text-xs text-neutral-500 mt-1.5 line-clamp-2 dark:text-neutral-400">
              {e.description}
            </p>
          )}
          <LinkFooter url={e.url} />
        </ColorBarShell>
      );
    };
  },
});

const CodeCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    return () => {
      const e = props.enrichment;
      const difficulty = e.attributes?.find(a => a.key === "difficulty");
      const number = e.attributes?.find(a => a.key === "number");
      const tags = e.attributes?.find(a => a.key === "tags");
      const diffColor = (() => {
        const d = String(difficulty?.value ?? "").toLowerCase();
        if (d === "easy")
          return "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400";
        if (d === "medium")
          return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400";
        if (d === "hard")
          return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
        return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
      })();
      return (
        <ColorBarShell color={colorFor(e)} href={e.url}>
          <div class="flex gap-1.5 items-center">
            {number && (
              <span class="text-[10px] text-neutral-700 font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:text-neutral-300 dark:bg-neutral-800">
                #
                {number.value}
              </span>
            )}
            {difficulty && (
              <span
                class={[
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                  diffColor,
                ]}
              >
                {String(difficulty.value)}
              </span>
            )}
            <Title mono>{e.title}</Title>
          </div>
          {tags && typeof tags.value === "string" && (
            <div class="text-xs text-neutral-500 mt-1 dark:text-neutral-400">
              {tags.value}
            </div>
          )}
          <AttributeRow
            attrs={e.attributes}
            exclude={["difficulty", "number", "tags"]}
            limit={3}
          />
          <LinkFooter url={e.url} />
        </ColorBarShell>
      );
    };
  },
});

const SelfCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    const subtypeLabel: Record<string, string> = {
      post: "博文",
      note: "手记",
      page: "页面",
    };
    return () => {
      const e = props.enrichment;
      const label = e.subtype ? subtypeLabel[e.subtype] || e.subtype : "";
      return (
        <ColorBarShell color={colorFor(e)} href={e.url}>
          <div class="flex gap-1.5 items-center">
            <span class="text-neutral-500">📝</span>
            {label && (
              <span class="text-[10px] text-blue-700 font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:text-blue-400 dark:bg-blue-950/50">
                {label}
              </span>
            )}
            <Title>{e.title}</Title>
          </div>
          {e.description && (
            <p class="text-xs text-neutral-500 mt-1 line-clamp-2 dark:text-neutral-400">
              {e.description}
            </p>
          )}
          <AttributeRow attrs={e.attributes} limit={3} />
          <LinkFooter url={e.url} self />
        </ColorBarShell>
      );
    };
  },
});

const FallbackCard = defineComponent({
  props: {
    enrichment: { type: Object as PropType<EnrichmentResult>, required: true },
  },
  setup(props) {
    return () => {
      const e = props.enrichment;
      return (
        <ImageShell href={e.url}>
          {e.image && (
            <img
              src={e.image.url}
              alt={e.image.alt || e.title}
              class="rounded shrink-0 size-[80px] object-cover"
              loading="lazy"
            />
          )}
          <div class="flex-1 min-w-0">
            <Title>{e.title}</Title>
            <div class="text-xs text-neutral-400 mt-0.5">
              {e.category}
              {e.subtype ? ` · ${e.subtype}` : ""}
            </div>
            <AttributeRow attrs={e.attributes} limit={3} />
            <LinkFooter url={e.url} />
          </div>
        </ImageShell>
      );
    };
  },
});

const FailureCard = defineComponent({
  props: {
    onRetry: Function as PropType<() => void>,
    retrying: { type: Boolean, default: false },
  },
  setup(props) {
    return () => (
      <div class="px-3 py-2 border border-yellow-200 rounded-lg bg-yellow-50 flex gap-2 items-center dark:border-yellow-900/50 dark:bg-yellow-950/30">
        <AlertIcon
          class="text-yellow-600 shrink-0 size-4 dark:text-yellow-500"
          aria-hidden="true"
        />
        <span class="text-xs text-yellow-800 flex-1 dark:text-yellow-300">
          未抓到 enrichment
        </span>
        {props.onRetry && (
          <NButton
            size="tiny"
            quaternary
            loading={props.retrying}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              props.onRetry?.();
            }}
          >
            {{
              icon: () =>
                props.retrying
                  ? (
                      <LoaderIcon class="size-3 animate-spin" aria-hidden="true" />
                    )
                  : (
                      <RefreshIcon class="size-3" aria-hidden="true" />
                    ),
              default: () => "重试",
            }}
          </NButton>
        )}
      </div>
    );
  },
});

const AttributeRow = defineComponent({
  props: {
    attrs: Array as PropType<EnrichmentAttribute[] | undefined>,
    exclude: { type: Array as PropType<string[]>, default: () => [] },
    limit: { type: Number, default: 3 },
  },
  setup(props) {
    const visible = computed(() => {
      const list = (props.attrs || []).filter(
        a => !props.exclude.includes(a.key),
      );
      return list.slice(0, props.limit);
    });
    return () => {
      if (visible.value.length === 0)
        return null;
      return (
        <div class="text-xs text-neutral-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5 items-center dark:text-neutral-400">
          {visible.value.map(a => (
            <span key={a.key} class="tabular-nums">
              {a.label ? `${a.label} ` : ""}
              {formatAttr(a)}
            </span>
          ))}
        </div>
      );
    };
  },
});
