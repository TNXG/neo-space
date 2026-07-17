import { Fingerprint as PasskeyIcon } from "lucide-vue-next";
import { defineComponent } from "vue";

import Avatar from "~/components/avatar";
import { QQIcon } from "~/components/icons/QQIcon";
import { API_URL } from "~/constants/env";

import { useLoginController } from "./use-login-controller";

const GithubIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33c.85 0 1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
  </svg>
);

/** 登录表单视图，只使用原生表单、焦点和键盘语义。 */
export const LoginPanel = defineComponent({
  setup() {
    const login = useLoginController();
    return () => {
      const showPassword = !login.settingsPending.value && login.settings.value?.password !== false;
      const showPasskey = !login.settingsPending.value && login.settings.value?.passkey && login.passkeySupported.value;
      const showOAuth = !login.settingsPending.value && (login.settings.value?.github || login.settings.value?.qq);
      const profile = login.identifiedProfile.value;

      return (
        <section class="max-w-[320px] w-full" aria-labelledby="login-title" aria-busy={login.settingsPending.value}>
          {profile
            ? (
                <div class="mb-6 flex flex-col items-center" aria-live="polite">
                  <div class="rounded-full h-20 w-20 ring-2 ring-white/30 overflow-hidden drop-shadow-xl">
                    <Avatar src={profile.avatar} size={80} />
                  </div>
                  <h1 id="login-title" class="text-xl text-white tracking-wide font-medium mt-3 drop-shadow-lg">
                    {profile.name || profile.username}
                  </h1>
                  <p class="text-sm text-white/65 mt-1">{profile.username}</p>
                </div>
              )
            : (
                <header class="mb-6 text-center">
                  <h1 id="login-title" class="text-xl text-white tracking-wide font-medium drop-shadow-lg">登录后台</h1>
                  <p class="text-sm text-white/65 mt-2">使用邮箱、用户名或其他登录方式</p>
                </header>
              )}

          {login.settingsPending.value && (
            <p class="text-sm text-white/65 text-center" role="status">正在加载登录方式…</p>
          )}

          {showPassword && (
            <form method="post" action={`${API_URL}/auth/tokens`} onSubmit={login.submitPasswordLogin} class="space-y-3">
              <div>
                <label for="login-username" class="sr-only">邮箱或用户名</label>
                <input
                  id="login-username"
                  name="username"
                  value={login.identifier.value}
                  onInput={login.updateIdentifier}
                  onChange={login.updateIdentifier}
                  onBlur={() => void login.identifyOwner()}
                  type="text"
                  autocomplete="username webauthn"
                  placeholder="邮箱或用户名"
                  required
                  autofocus
                  disabled={login.isBusy.value}
                  class="text-sm text-white px-4 outline-none border border-white/15 rounded-md bg-white/20 h-10 w-full ring-0 transition-all backdrop-blur-md placeholder:text-white/60 focus:border-white/40 focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
                />
              </div>
              <div>
                <label for="login-password" class="sr-only">密码</label>
                <input
                  id="login-password"
                  name="password"
                  value={login.password.value}
                  onInput={login.updatePassword}
                  onChange={login.updatePassword}
                  type="password"
                  autocomplete="current-password"
                  placeholder="密码"
                  required
                  disabled={login.isBusy.value}
                  class="text-sm text-white px-4 outline-none border border-white/15 rounded-md bg-white/20 h-10 w-full ring-0 transition-all backdrop-blur-md placeholder:text-white/60 focus:border-white/40 focus-visible:ring-2 focus-visible:ring-white/30 disabled:opacity-50"
                />
              </div>
              <button type="submit" onClick={login.usePasskeyForEmptyPasswordForm} disabled={login.isBusy.value} class="text-sm text-neutral-900 font-medium rounded-md bg-white h-10 w-full cursor-pointer transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50">
                {login.isPasswordSubmitting.value ? "正在登录…" : "登录"}
              </button>
            </form>
          )}

          {showPasskey && (
            <button type="button" onClick={() => void login.submitPasskeyLogin()} disabled={login.isBusy.value} class="text-sm text-white/90 mt-3 rounded-md bg-white/15 flex h-10 w-full cursor-pointer transition-colors items-center justify-center gap-2 backdrop-blur-sm hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:cursor-not-allowed disabled:opacity-50">
              <PasskeyIcon class="size-4" />
              {login.isPasskeySubmitting.value ? "正在验证…" : "使用 Passkey 登录"}
            </button>
          )}

          {!login.settingsPending.value && login.settings.value?.passkey && !login.passkeySupported.value && (
            <p class="text-xs text-white/60 mt-3 text-center" role="status">
              当前浏览器或设备不支持 Passkey，请使用其他登录方式
            </p>
          )}

          {showOAuth && (
            <div class="mt-6 border-white/15 border-t pt-5">
              <p class="text-xs text-white/55 mb-3 text-center">其他登录方式</p>
              <div class="flex gap-4 justify-center">
                {login.settings.value?.github && (
                  <button type="button" onClick={() => login.startSocialLogin("github")} aria-label="使用 GitHub 登录" class="text-white/80 rounded-md bg-white/15 flex h-9 w-9 cursor-pointer transition-all items-center justify-center backdrop-blur-sm hover:text-white focus-visible:outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/50">
                    <GithubIcon />
                  </button>
                )}
                {login.settings.value?.qq && (
                  <button type="button" onClick={() => login.startSocialLogin("qq")} aria-label="使用 QQ 登录" class="text-white/80 rounded-md bg-white/15 flex h-9 w-9 cursor-pointer transition-all items-center justify-center backdrop-blur-sm hover:text-white focus-visible:outline-none hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white/50">
                    <QQIcon class="size-5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      );
    };
  },
});
