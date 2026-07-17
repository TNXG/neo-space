import { defineComponent } from "vue";

import { LoginPanel } from "./LoginPanel";

/** 后台登录页容器。 */
export const LoginView = defineComponent({
  setup() {
    return () => (
      <main class="p-4 flex min-h-screen items-center justify-center">
        <LoginPanel />
      </main>
    );
  },
});

export default LoginView;
