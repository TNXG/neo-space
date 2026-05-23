import { useQuery } from "@tanstack/vue-query";
import { storeToRefs } from "pinia";
import {
  defineComponent,
  onBeforeMount,
  onBeforeUnmount,
  onMounted,
  ref,
} from "vue";
import { useRoute, useRouter } from "vue-router";

import { toast } from "vue-sonner";

import { userApi } from "~/api/user";
import Avatar from "~/components/avatar";
import { API_URL } from "~/constants/env";
import { SESSION_WITH_LOGIN } from "~/constants/keys";
import { queryKeys } from "~/hooks/queries/keys";
import { useUserStore } from "~/stores/user";

const GithubIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
  </svg>
);

const QQIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M12.01 2C6.49 2 2 5.58 2 10c0 2.56 1.5 4.83 3.84 6.29l-.86 3.15a.5.5 0 0 0 .73.56l3.38-1.85c.91.22 1.89.34 2.92.34 5.52 0 10.01-3.58 10.01-8.01S17.53 2 12.01 2Zm-3.5 9.1c-.65 0-1.18-.58-1.18-1.29 0-.72.53-1.3 1.18-1.3.66 0 1.19.58 1.19 1.3 0 .71-.53 1.29-1.19 1.29Zm3.5 0c-.65 0-1.18-.58-1.18-1.29 0-.72.53-1.3 1.18-1.3.66 0 1.19.58 1.19 1.3 0 .71-.53 1.29-1.19 1.29Zm3.51 0c-.66 0-1.19-.58-1.19-1.29 0-.72.53-1.3 1.19-1.3.65 0 1.18.58 1.18 1.3 0 .71-.53 1.29-1.18 1.29Z" />
  </svg>
);

export const LoginView = defineComponent({
  setup() {
    const userStore = useUserStore();
    const { user } = storeToRefs(userStore);

    const router = useRouter();
    const route = useRoute();
    const inputRef = ref<HTMLInputElement | null>(null);
    const password = ref("");
    const isLoading = ref(false);

    onBeforeMount(async () => {
      await userStore.fetchUser();
    });

    onMounted(() => {
      const focusInput = () => {
        inputRef.value?.focus();
      };

      focusInput();
      document.addEventListener("keydown", focusInput);

      onBeforeUnmount(() => {
        document.removeEventListener("keydown", focusInput);
      });
    });

    const postSuccessfulLogin = async () => {
      sessionStorage.setItem(SESSION_WITH_LOGIN, "1");
      await router.replace(
        route.query.from ? decodeURI(route.query.from as string) : "/dashboard",
      );
      toast.success("欢迎回来");
    };

    const { data: settings } = useQuery({
      queryKey: queryKeys.user.allowLogin(),
      queryFn: () => userApi.getAllowLogin(),
    });

    const handleLogin = async (e: Event) => {
      e?.stopPropagation();
      e.preventDefault();

      if (isLoading.value)
        return;

      try {
        const username = user.value?.username || user.value?.handle;
        if (!username) {
          toast.error("主人用户名无法获取");
          return;
        }

        isLoading.value = true;

        const loginResponse = await userApi.loginWithPassword({
          username,
          password: password.value,
        });
        user.value = {
          ...loginResponse.user,
          avatar: loginResponse.user.avatar || loginResponse.user.image,
        };

        await postSuccessfulLogin();
      } catch {
        toast.error("登录失败");
      } finally {
        isLoading.value = false;
      }
    };

    const handleSocialLogin = (provider: "github" | "qq") => {
      window.location.href = `${API_URL}/auth/oauth/${provider}?return_to=admin`;
    };

    return () => {
      const showPasswordInput
        = typeof settings.value === "undefined"
          || settings.value?.password === true;

      const hasAlternativeAuth
        = settings.value?.github
          || settings.value?.qq;

      return (
        <div class="p-4 flex flex-col min-h-screen items-center justify-center">
          <div class="mb-4 relative">
            <div class="rounded-full h-[120px] w-[120px] ring-4 ring-white/30 overflow-hidden drop-shadow-2xl">
              <Avatar src={user.value?.avatar} size={120} />
            </div>
          </div>

          <h1 class="text-xl text-white tracking-wide font-medium mb-6 drop-shadow-lg">
            {user.value?.name || user.value?.username || ""}
          </h1>

          {showPasswordInput && (
            <form onSubmit={handleLogin} class="max-w-[280px] w-full">
              <div class="mb-4 relative">
                <label for="password-input" class="sr-only">
                  密码
                </label>
                <input
                  id="password-input"
                  ref={inputRef}
                  value={password.value}
                  onInput={(e: Event) => {
                    password.value = (e.target as HTMLInputElement).value;
                  }}
                  type="password"
                  autocomplete="current-password"
                  placeholder="输入密码"
                  disabled={isLoading.value}
                  class="text-sm text-white px-4 text-center outline-none border-0 rounded-full bg-white/20 h-[38px] w-full ring-0 transition-all backdrop-blur-md placeholder:text-white/60 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button type="submit" class="sr-only">
                  登录
                </button>
              </div>
            </form>
          )}

          {hasAlternativeAuth && (
            <div class="mt-6 flex gap-4 justify-center">
              {settings.value?.github && (
                <button
                  type="button"
                  onClick={() => handleSocialLogin("github")}
                  aria-label="使用 GitHub 登录"
                  class="text-white/80 rounded-full bg-white/15 flex h-9 w-9 transition-all items-center justify-center backdrop-blur-sm hover:text-white focus-visible:outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <GithubIcon />
                </button>
              )}

              {settings.value?.qq && (
                <button
                  type="button"
                  onClick={() => handleSocialLogin("qq")}
                  aria-label="使用 QQ 登录"
                  class="text-white/80 rounded-full bg-white/15 flex h-9 w-9 transition-all items-center justify-center backdrop-blur-sm hover:text-white focus-visible:outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/50"
                >
                  <QQIcon />
                </button>
              )}
            </div>
          )}
        </div>
      );
    };
  },
});

export default LoginView;
