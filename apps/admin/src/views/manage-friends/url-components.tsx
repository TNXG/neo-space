import { NPopover } from "naive-ui";
import { defineComponent } from "vue";

export const UrlComponent = defineComponent({
  props: {
    url: String,
    errorMessage: String,
    status: [String, Number],
  },
  setup(props) {
    return () => (
      <div class="flex items-center space-x-2">
        <a target="_blank" href={props.url} rel="noreferrer">
          {props.url}
        </a>

        {typeof props.status !== "undefined"
          && (props.errorMessage
            ? (
                <NPopover>
                  {{
                    trigger() {
                      return <div class="rounded-full bg-red-400 size-2" />;
                    },
                    default() {
                      return props.errorMessage;
                    },
                  }}
                </NPopover>
              )
            : (
                <div class="rounded-full bg-green-300 size-2" />
              ))}
      </div>
    );
  },
});
