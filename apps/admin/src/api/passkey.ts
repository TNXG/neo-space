import type { LoginResponse } from "./user";
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";

import { setAdminAuthToken } from "~/utils/admin-auth";
import { request } from "~/utils/request";

interface ApiEnvelope<T> {
  data: T;
}

interface RegistrationStartResponse {
  challengeId: string;
  options: {
    publicKey: Parameters<typeof startRegistration>[0]["optionsJSON"];
  };
}

interface AuthenticationStartResponse {
  challengeId: string;
  options: {
    publicKey: Parameters<typeof startAuthentication>[0]["optionsJSON"];
  };
}

export interface PasskeySummary {
  _id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string | null;
}

/** 注册新的 Passkey，并让浏览器完成 WebAuthn ceremony。 */
const register = async (name: string): Promise<PasskeySummary> => {
  const start = await request.post<ApiEnvelope<RegistrationStartResponse>>(
    "/auth/passkeys/register/start",
    { data: { name }, bypassTransform: true },
  );
  const credential = await startRegistration({
    optionsJSON: start.data.options.publicKey,
  });
  const finish = await request.post<ApiEnvelope<PasskeySummary>>(
    "/auth/passkeys/register/finish",
    {
      data: {
        challengeId: start.data.challengeId,
        name,
        credential,
      },
      bypassTransform: true,
    },
  );
  return finish.data;
};

/** 使用 Passkey 登录；条件式模式允许浏览器在 username 输入框中展示凭据。 */
const authenticate = async (
  identifier?: string,
  useBrowserAutofill = false,
): Promise<LoginResponse> => {
  if (!browserSupportsWebAuthn()) {
    throw new Error("当前浏览器或设备不支持 Passkey");
  }
  const start = await request.post<ApiEnvelope<AuthenticationStartResponse>>(
    "/auth/passkeys/authenticate/start",
    {
      data: identifier ? { identifier } : {},
      bypassTransform: true,
    },
  );
  const credential = await startAuthentication({
    optionsJSON: start.data.options.publicKey,
    useBrowserAutofill,
  });
  const finish = await request.post<ApiEnvelope<LoginResponse>>(
    "/auth/passkeys/authenticate/finish",
    {
      data: { challengeId: start.data.challengeId, credential },
      bypassTransform: true,
    },
  );
  setAdminAuthToken(finish.data.token);
  return finish.data;
};

export const passkeyApi = {
  /** 获取当前 Owner 的 Passkey 列表。 */
  list: async (): Promise<PasskeySummary[]> => {
    const response
      = await request.get<ApiEnvelope<PasskeySummary[]>>("/auth/passkeys", {
        bypassTransform: true,
      });
    return response.data;
  },
  register,
  authenticate,
  supports: browserSupportsWebAuthn,
  supportsAutofill: browserSupportsWebAuthnAutofill,
  cancel: () => WebAuthnAbortService.cancelCeremony(),
  /** 删除一个 Passkey。 */
  delete: async (id: string): Promise<void> => {
    await request.delete<ApiEnvelope<void>>(`/auth/passkeys/${id}`, {
      bypassTransform: true,
    });
  },
};
