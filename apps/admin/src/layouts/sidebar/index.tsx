import type { CSSProperties } from "vue";
import { computed, defineComponent, onUnmounted, watchEffect } from "vue";

import { KBarWrapper } from "~/components/k-bar";
import { ContentLayout } from "~/layouts/content";
import $RouterView from "~/layouts/router-view";

import { Sidebar } from "../../components/sidebar";
import { useStoreRef } from "../../hooks/use-store-ref";
import { UIStore } from "../../stores/ui";
import styles from "./index.module.css";

export const SidebarLayout = defineComponent({
  name: "SidebarLayout",

  setup() {
    const ui = useStoreRef(UIStore);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key.toLowerCase() === "b") {
        const activeElement = document.activeElement;
        const isInEditor
          = activeElement?.tagName === "TEXTAREA"
            || activeElement?.tagName === "INPUT"
            || activeElement?.getAttribute("contenteditable") === "true"
            || activeElement?.closest(".monaco-editor")
            || activeElement?.closest("[role=\"textbox\"]");

        if (!isInEditor) {
          e.preventDefault();
          collapse.value = !collapse.value;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onUnmounted(() => {
      window.removeEventListener("keydown", handleKeyDown);
    });

    const collapse = ui.sidebarCollapse;
    const isLaptop = computed(
      () => ui.viewport.value.mobile || ui.viewport.value.pad,
    );
    watchEffect(() => {
      collapse.value = !!isLaptop.value;
    });

    return () => (
      <KBarWrapper>
        {{
          default() {
            return (
              <div
                class={[styles.root, collapse.value ? "collapsed" : "expanded"]}
              >
                <Sidebar
                  collapse={collapse.value}
                  onCollapseChange={(s) => {
                    collapse.value = s;
                  }}
                />

                {/* 移动端遮罩层 */}
                {isLaptop.value && !collapse.value && (
                  <div
                    class={styles.overlay}
                    onClick={() => (collapse.value = true)}
                  />
                )}

                <div
                  class={styles.content}
                  style={
                    {
                      left: !collapse.value ? "var(--sidebar-width)" : "0",
                      pointerEvents:
                        isLaptop.value && !collapse.value ? "none" : "auto",
                    } as CSSProperties
                  }
                >
                  <div class={styles.container}>
                    <ContentLayout>
                      <$RouterView />
                    </ContentLayout>
                  </div>
                </div>
              </div>
            );
          },
        }}
      </KBarWrapper>
    );
  },
});
