import { defineComponent, onMounted, ref } from "vue";
import { RouterView } from "vue-router";

import { bgUrl } from "~/constants/env";

import styles from "./auth-view.module.css";

export const AuthView = defineComponent({
  name: "AuthView",
  setup() {
    const loaded = ref(false);

    onMounted(() => {
      const img = new Image();
      img.src = bgUrl;
      img.addEventListener("load", () => {
        loaded.value = true;
      });
    });

    return () => (
      <div class="min-h-screen relative isolate">
        <div
          class={styles.bg}
          style={{
            backgroundImage: `url(${bgUrl})`,
            opacity: loaded.value ? 1 : 0.4,
          }}
        />
        {/* Dark overlay for contrast */}
        <div class="bg-black/40 inset-0 fixed -z-10" />
        <RouterView />
      </div>
    );
  },
});

export default AuthView;
