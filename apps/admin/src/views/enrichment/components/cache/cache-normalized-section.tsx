import type { PropType } from "vue";
import type { EnrichmentResult } from "~/models/enrichment";
import { defineComponent } from "vue";

export const CacheNormalizedSection = defineComponent({
  name: "CacheNormalizedSection",
  props: {
    result: { type: Object as PropType<EnrichmentResult>, required: true },
    title: { type: String, default: "标准化字段" },
  },
  setup(props) {
    return () => {
      const { result } = props;
      const image = result.image;
      const attributes = result.attributes ?? [];
      const links = result.links ?? [];
      return (
        <section>
          <h3 class="text-sm text-neutral-700 font-medium mb-3 dark:text-neutral-300">
            {props.title}
          </h3>
          <div class="space-y-4">
            <Field label="标题">
              <span class="text-sm text-neutral-900 dark:text-neutral-100">
                {result.title || "—"}
              </span>
            </Field>
            <Field label="描述">
              <span class="text-sm text-neutral-700 whitespace-pre-wrap dark:text-neutral-300">
                {result.description || "—"}
              </span>
            </Field>
            <Field label="封面图">
              {image
                ? (
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="border border-neutral-200 rounded-md max-w-xs block overflow-hidden dark:border-neutral-800"
                    >
                      <img
                        src={image.url}
                        alt={image.alt || ""}
                        class="w-full object-cover"
                        loading="lazy"
                      />
                    </a>
                  )
                : (
                    <span class="text-xs text-neutral-400">无</span>
                  )}
            </Field>
            {attributes.length > 0 && (
              <Field label="属性">
                <div class="border border-neutral-200 rounded-md overflow-hidden dark:border-neutral-800">
                  <table class="text-xs w-full">
                    <tbody class="divide-neutral-100 divide-y dark:divide-neutral-800">
                      {attributes.map(a => (
                        <tr key={a.key}>
                          <td class="text-neutral-500 font-medium px-3 py-1.5 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-900">
                            {a.label || a.key}
                          </td>
                          <td class="text-neutral-700 px-3 py-1.5 dark:text-neutral-300">
                            {String(a.value)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Field>
            )}
            {links.length > 0 && (
              <Field label="链接">
                <ul class="text-xs space-y-1">
                  {links.map(l => (
                    <li key={`${l.rel}-${l.url}`}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-neutral-700 inline-flex gap-1 items-center dark:text-neutral-300 hover:underline"
                      >
                        <span class="font-mono px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                          {l.rel}
                        </span>
                        <span class="truncate">{l.label || l.url}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </Field>
            )}
          </div>
        </section>
      );
    };
  },
});

const Field = defineComponent({
  name: "Field",
  props: {
    label: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => (
      <div>
        <div class="text-xs text-neutral-500 font-medium mb-1 dark:text-neutral-400">
          {props.label}
        </div>
        {slots.default?.()}
      </div>
    );
  },
});
