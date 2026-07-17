import type { LoginResponse, OwnerLoginProfile } from "~/api/user";
import { useQuery } from "@tanstack/vue-query";
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";

import { passkeyApi } from "~/api/passkey";
import { userApi } from "~/api/user";
import { API_URL } from "~/constants/env";
import { SESSION_WITH_LOGIN } from "~/constants/keys";
import { queryKeys } from "~/hooks/queries/keys";
import { useUserStore } from "~/stores/user";

import { resolvePostLoginTarget } from "./login-target";

/** 管理密码、Passkey、OAuth 三条互不混淆的登录流程。 */
export const useLoginController = () => {
  const { user } = storeToRefs(useUserStore());
  const router = useRouter();
  const route = useRoute();
  const identifier = ref("");
  const password = ref("");
  const identifiedProfile = ref<OwnerLoginProfile | null>(null);
  const identifiedIdentifier = ref("");
  const isIdentifying = ref(false);
  const isPasswordSubmitting = ref(false);
  const isPasskeySubmitting = ref(false);
  const passkeySupported = ref(false);
  const automaticPasskeyStarted = ref(false);
  const loginCompleted = ref(false);
  const { data: settings, isPending: settingsPending } = useQuery({
    queryKey: queryKeys.user.allowLogin(),
    queryFn: () => userApi.getAllowLogin(),
  });
  const isBusy = computed(
    () => isPasswordSubmitting.value || isPasskeySubmitting.value,
  );

  /** 登录成功后只导航一次，避免条件式 Passkey 与密码提交发生竞态。 */
  const completeLogin = async (response: LoginResponse) => {
    if (loginCompleted.value)
      return;
    loginCompleted.value = true;
    user.value = { ...response.user, avatar: response.user.avatar || response.user.image };
    sessionStorage.setItem(SESSION_WITH_LOGIN, "1");
    await router.replace(resolvePostLoginTarget(route.query.from));
    toast.success("欢迎回来");
  };

  /** 同步账号输入并立即隐藏与当前输入不匹配的用户资料。 */
  const updateIdentifier = (event: Event) => {
    const nextIdentifier = (event.target as HTMLInputElement).value;
    identifier.value = nextIdentifier;
    if (nextIdentifier.trim() !== identifiedIdentifier.value) {
      identifiedProfile.value = null;
      identifiedIdentifier.value = "";
    }
  };

  /** 同步密码输入；提交时仍会从 FormData 二次读取自动填充值。 */
  const updatePassword = (event: Event) => {
    password.value = (event.target as HTMLInputElement).value;
  };

  /** 仅在账号匹配 Owner 后展示公开资料，且不主动改变焦点。 */
  const identifyOwner = async () => {
    const candidate = identifier.value.trim();
    if (!candidate || isIdentifying.value)
      return;
    isIdentifying.value = true;
    try {
      const result = await userApi.identifyOwner(candidate);
      if (identifier.value.trim() !== candidate)
        return;
      identifiedProfile.value = result.matched ? result.profile : null;
      identifiedIdentifier.value = result.matched ? candidate : "";
    } catch {
      identifiedProfile.value = null;
      identifiedIdentifier.value = "";
    } finally {
      isIdentifying.value = false;
    }
  };

  /** 使用标准表单提交，并通过 FormData 兼容 1Password 等静默自动填充。 */
  const submitPasswordLogin = async (event: Event) => {
    event.preventDefault();
    if (isBusy.value)
      return;
    const formData = new FormData(event.currentTarget as HTMLFormElement);
    const submittedIdentifier = String(formData.get("username") ?? "").trim();
    const submittedPassword = String(formData.get("password") ?? "");
    identifier.value = submittedIdentifier;
    password.value = submittedPassword;
    passkeyApi.cancel();
    isPasswordSubmitting.value = true;
    try {
      await completeLogin(await userApi.loginWithPassword({
        identifier: submittedIdentifier,
        password: submittedPassword,
      }));
    } catch {
      toast.error("邮箱、用户名或密码不正确");
    } finally {
      isPasswordSubmitting.value = false;
    }
  };

  /** 主动触发 Passkey，不依赖账号输入，也不提交密码表单。 */
  const submitPasskeyLogin = async () => {
    if (isBusy.value || !passkeySupported.value)
      return;
    isPasskeySubmitting.value = true;
    try {
      await completeLogin(await passkeyApi.authenticate());
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "NotAllowedError")
        toast.info("已取消 Passkey 登录");
      else toast.error(error instanceof Error ? error.message : "Passkey 登录失败");
    } finally {
      isPasskeySubmitting.value = false;
    }
  };

  /** 点击登录且账号、密码均为空时，将该动作解释为主动使用 Passkey。 */
  const usePasskeyForEmptyPasswordForm = (event: MouseEvent) => {
    if (!settings.value?.passkey || !passkeySupported.value)
      return;
    const submitButton = event.currentTarget as HTMLButtonElement;
    const form = submitButton.form;
    const usernameInput = form?.elements.namedItem("username") as HTMLInputElement | null;
    const passwordInput = form?.elements.namedItem("password") as HTMLInputElement | null;
    if (usernameInput?.value.trim() || passwordInput?.value)
      return;
    event.preventDefault();
    void submitPasskeyLogin();
  };

  /** 条件式 UI 不可用、无凭据或被取消时静默降级到其他登录方式。 */
  const startAutomaticPasskey = async () => {
    if (automaticPasskeyStarted.value || !settings.value?.passkey || !settings.value.passkeyAutomatic)
      return;
    automaticPasskeyStarted.value = true;
    await nextTick();
    if (!(await passkeyApi.supportsAutofill()))
      return;
    try {
      await completeLogin(await passkeyApi.authenticate(undefined, true));
    } catch {
      // 条件式请求保持静默，避免影响密码和 OAuth 登录。
    }
  };

  /** 取消挂起的 WebAuthn ceremony，再显式进入指定 OAuth 流程。 */
  const startSocialLogin = (provider: "github" | "qq") => {
    passkeyApi.cancel();
    window.location.assign(`${API_URL}/auth/oauth/${provider}?return_to=admin`);
  };

  onMounted(() => {
    passkeySupported.value = passkeyApi.supports();
  });
  watch(
    () => [settings.value?.passkey, settings.value?.passkeyAutomatic] as const,
    () => void startAutomaticPasskey(),
    { immediate: true },
  );

  return {
    identifier,
    password,
    identifiedProfile,
    isPasswordSubmitting,
    isPasskeySubmitting,
    isBusy,
    passkeySupported,
    settings,
    settingsPending,
    updateIdentifier,
    updatePassword,
    identifyOwner,
    submitPasswordLogin,
    submitPasskeyLogin,
    usePasskeyForEmptyPasswordForm,
    startSocialLogin,
  };
};
