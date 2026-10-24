"use client";

import type { AuthenticationResponseJSON } from "@simplewebauthn/browser";
import { browserSupportsWebAuthn, browserSupportsWebAuthnAutofill, startAuthentication, WebAuthnAbortService, WebAuthnError } from "@simplewebauthn/browser";
import type { DashboardPasskeyChallenge } from "@/types/api";

class DashboardPasskeyError extends Error {}

/** 自动请求优先使用条件式填充；不支持时仍保留系统验证器与密码表单。 */
export async function authenticateDashboardPasskey(challenge: DashboardPasskeyChallenge, automatic = false, signal?: AbortSignal): Promise<AuthenticationResponseJSON> {
  if (typeof window === "undefined" || !window.isSecureContext) {
    throw new DashboardPasskeyError("Passkey 需要 HTTPS 安全连接；本地开发请使用 localhost。");
  }
  if (!browserSupportsWebAuthn() || !navigator.credentials) {
    throw new DashboardPasskeyError("当前浏览器不支持 Passkey，请更新浏览器或使用密码登录。");
  }
  if (!challenge.challengeId || !challenge.options?.publicKey?.challenge) {
    throw new DashboardPasskeyError("认证服务返回的 Passkey 挑战无效，请重新发起登录。");
  }

  const useBrowserAutofill = automatic && await browserSupportsWebAuthnAutofill();
  signal?.throwIfAborted();
  signal?.addEventListener("abort", cancelDashboardPasskey, { once: true });
  try {
    const credential = await startAuthentication({ optionsJSON: challenge.options.publicKey, useBrowserAutofill });
    signal?.throwIfAborted();
    return credential;
  } finally {
    signal?.removeEventListener("abort", cancelDashboardPasskey);
  }
}

/** 在切换登录方式或离开页面时取消尚未完成的系统验证。 */
export function cancelDashboardPasskey(): void {
  WebAuthnAbortService.cancelCeremony();
}

/** 自动登录取消不作为密码表单的错误，手动登录则保留取消反馈。 */
export function isDashboardPasskeyCancellation(error: unknown): boolean {
  if (error instanceof WebAuthnError) {
    return error.code === "ERROR_CEREMONY_ABORTED" || isDashboardPasskeyCancellation(error.cause);
  }
  return error instanceof Error && (error.name === "NotAllowedError" || error.name === "AbortError");
}

/** 将浏览器取消、设备不支持和 RP/来源配置问题转换成可操作的提示。 */
export function getDashboardPasskeyError(error: unknown): string {
  if (error instanceof DashboardPasskeyError) {
    return error.message;
  }

  if (error instanceof WebAuthnError) {
    if (error.code === "ERROR_INVALID_DOMAIN" || error.code === "ERROR_INVALID_RP_ID") {
      return "当前域名与 Passkey 的 RP 配置不匹配，请在登记凭据的正确站点登录，或联系管理员检查配置。";
    }
    if (error.code === "ERROR_CEREMONY_ABORTED") {
      return "Passkey 登录已取消，请重新点击登录。";
    }
    if (error.code === "ERROR_AUTHENTICATOR_GENERAL_ERROR") {
      return "验证设备无法完成 Passkey 签名，请检查设备或使用密码登录。";
    }
    if (error.cause instanceof Error) {
      return getDashboardPasskeyError(error.cause);
    }
  }

  if (error instanceof Error) {
    if (error.name === "NotAllowedError") {
      return "Passkey 验证已取消、超时或没有找到匹配的凭据，请重试或使用密码登录。";
    }
    if (error.name === "AbortError") {
      return "Passkey 登录已取消，请重新点击登录。";
    }
    if (error.name === "SecurityError") {
      return "当前来源无法使用此 Passkey，请确认使用 HTTPS，并检查后端允许的来源与 RP 域名。";
    }
    if (error.name === "NotSupportedError") {
      return "浏览器或验证设备不支持此 Passkey，请使用其他设备或密码登录。";
    }
    if (error.name === "InvalidStateError") {
      return "验证设备当前不可用，请连接或解锁设备后重试。";
    }
  }

  return "无法完成 Passkey 验证，请重试或使用密码登录。";
}
