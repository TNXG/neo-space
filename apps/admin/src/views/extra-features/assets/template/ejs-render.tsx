import type { PropType } from "vue";
import { defineComponent, ref, watch } from "vue";

type TemplateData = Record<string, unknown>;

type TemplateRenderer = (
  locals: TemplateData,
  escapeHtml: (value: unknown) => string,
) => Promise<string>;

const TEMPLATE_TAG_PATTERN = /(<%%|%%>|<%[-_=#]?[\s\S]*?[-_]?%>)/g;

/**
 * Escapes interpolated values for HTML output.
 *
 * The template preview only needs client-side rendering, so this local renderer
 * avoids bundling the Node-oriented EJS package into the browser build.
 */
const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Renders the EJS subset used by asset templates:
 *
 * 1. `<% code %>` executes JavaScript.
 * 2. `<%= value %>` appends escaped output.
 * 3. `<%- value %>` appends raw output.
 * 4. `<%# comment %>` is ignored.
 */
const renderTemplate = async (template: string, data: TemplateData) => {
  let cursor = 0;
  let source = "";
  const appendText = (text: string) => {
    if (text) {
      source += `__append(${JSON.stringify(text)});\n`;
    }
  };

  for (const match of template.matchAll(TEMPLATE_TAG_PATTERN)) {
    const token = match[0];
    appendText(template.slice(cursor, match.index));
    cursor = match.index + token.length;

    if (token === "<%%") {
      appendText("<%");
      continue;
    }

    if (token === "%%>") {
      appendText("%>");
      continue;
    }

    const body = token
      .replace(/^<%[-_]?/, "")
      .replace(/[-_]?%>$/, "")
      .trim();

    if (token.startsWith("<%#")) {
      continue;
    }

    if (token.startsWith("<%=")) {
      source += `__append(escapeHtml(${body}));\n`;
      continue;
    }

    if (token.startsWith("<%-")) {
      source += `__append(${body});\n`;
      continue;
    }

    source += `${body}\n`;
  }

  appendText(template.slice(cursor));

  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as {
    new (...args: string[]): TemplateRenderer;
  };
  const renderer = new AsyncFunction(
    "locals",
    "escapeHtml",
    `
let __output = "";
const __append = (value) => {
  if (value !== undefined && value !== null) {
    __output += String(value);
  }
};
with (locals ?? {}) {
${source}
}
return __output;
`,
  );

  return renderer(data, escapeHtml);
};

export const EJSRender = defineComponent({
  props: {
    template: {
      type: String,
      required: true,
    },
    data: {
      type: Object,
      required: true,
    },
    onError: {
      type: Function as PropType<(err: Error) => void>,
    },
  },
  setup(props) {
    const html = ref("");
    watch(
      () => props.template,
      async () => {
        html.value = await renderTemplate(props.template, props.data as TemplateData)
          .catch((error) => {
            props.onError?.(error);

            console.error(error);

            return html.value;
          });
      },
      { immediate: true },
    );

    return () => (
      <div class="bg-white h-full overflow-auto">
        <div innerHTML={html.value} />
      </div>
    );
  },
});
