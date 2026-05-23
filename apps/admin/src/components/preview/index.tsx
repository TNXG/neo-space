import { defineComponent } from "vue";

export const ArticlePreview = defineComponent({
  props: {
    url: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () => <iframe src={props.url} class="h-[60vh] max-w-full w-[60ch]" />;
  },
});
