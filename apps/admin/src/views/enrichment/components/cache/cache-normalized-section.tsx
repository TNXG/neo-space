import { defineComponent } from 'vue'
import type { EnrichmentResult } from '~/models/enrichment'
import type { PropType } from 'vue'

export const CacheNormalizedSection = defineComponent({
  name: 'CacheNormalizedSection',
  props: {
    result: { type: Object as PropType<EnrichmentResult>, required: true },
    title: { type: String, default: '标准化字段' },
  },
  setup(props) {
    return () => {
      const { result } = props
      const image = result.image
      const attributes = result.attributes ?? []
      const links = result.links ?? []
      return (
        <section>
          <h3 class="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {props.title}
          </h3>
          <div class="space-y-4">
            <Field label="标题">
              <span class="text-sm text-neutral-900 dark:text-neutral-100">
                {result.title || '—'}
              </span>
            </Field>
            <Field label="描述">
              <span class="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">
                {result.description || '—'}
              </span>
            </Field>
            <Field label="封面图">
              {image ? (
                <a
                  href={image.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="block max-w-xs overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800"
                >
                  <img
                    src={image.url}
                    alt={image.alt || ''}
                    class="w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <span class="text-xs text-neutral-400">无</span>
              )}
            </Field>
            {attributes.length > 0 && (
              <Field label="属性">
                <div class="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
                  <table class="w-full text-xs">
                    <tbody class="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {attributes.map((a) => (
                        <tr key={a.key}>
                          <td class="bg-neutral-50 px-3 py-1.5 font-medium text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
                            {a.label || a.key}
                          </td>
                          <td class="px-3 py-1.5 text-neutral-700 dark:text-neutral-300">
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
                <ul class="space-y-1 text-xs">
                  {links.map((l) => (
                    <li key={`${l.rel}-${l.url}`}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 text-neutral-700 hover:underline dark:text-neutral-300"
                      >
                        <span class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-800">
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
      )
    }
  },
})

const Field = defineComponent({
  name: 'Field',
  props: {
    label: { type: String, required: true },
  },
  setup(props, { slots }) {
    return () => (
      <div>
        <div class="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {props.label}
        </div>
        {slots.default?.()}
      </div>
    )
  },
})
