import type { VNode } from "vue";
import type { RouteLocation } from "vue-router";
import { NSpin } from "naive-ui";
import { cloneVNode, defineComponent, Suspense } from "vue";
import { RouterView } from "vue-router";

const $RouterView = defineComponent({
  setup() {
    return () => (
      <RouterView>
        {{
          default({ Component, route }: { Component?: VNode; route: RouteLocation }) {
            return (
              <Suspense>
                {{
                  default: () =>
                    Component
                      ? cloneVNode(Component, { key: String(route.name ?? route.path) })
                      : null,

                  fallback() {
                    return (
                      <div class="text-primary transform left-1/2 top-1/2 fixed -translate-x-1/2 -translate-y-1/2">
                        <NSpin strokeWidth={14} show rotate />
                      </div>
                    );
                  },
                }}
              </Suspense>
            );
          },
        }}
      </RouterView>
    );
  },
});
export default $RouterView;
