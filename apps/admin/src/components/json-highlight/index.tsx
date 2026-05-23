import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";
import { defineComponent, onMounted, ref, watch } from "vue";

import "highlight.js/styles/atom-one-dark.css";

hljs.registerLanguage("json", json);

export const JSONHighlight = defineComponent({
  props: {
    code: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const $ref = ref<HTMLElement>();

    const highlight = () => {
      const result = hljs.highlight("json", props.code);
      if (!$ref.value)
        return;

      $ref.value.innerHTML = result.value;
    };
    onMounted(() => {
      highlight();
    });
    watch(
      () => props.code,
      () => {
        highlight();
      },
    );

    return () => {
      return (
        <pre
          class="p-4 rounded-xl bg-dark-800 overflow-auto"
          style={{
            color: "#bbb",
          }}
          ref={$ref}
        />
      );
    };
  },
});
