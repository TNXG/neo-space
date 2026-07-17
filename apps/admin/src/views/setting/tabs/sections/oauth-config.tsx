import type { Component, PropType } from "vue";
import type { OptionValue } from "~/api/options";
import { cloneDeep } from "es-toolkit/compat";
import { Github as GithubIcon } from "lucide-vue-next";
import { NInput, NSwitch } from "naive-ui";
import { defineComponent } from "vue";

import { QQIcon } from "~/components/icons/QQIcon";
import { SettingsRow, SettingsSection } from "~/layouts/settings-layout";

import { PasskeySecuritySection } from "./passkey-security";

type OptionRecord = Record<string, OptionValue>;

interface ProviderDefinition {
  type: "github" | "qq";
  title: string;
  description: string;
  publicLabel?: string;
  publicKey?: "clientId";
  secretLabel?: string;
  secretKey?: "clientSecret";
  icon: Component;
}

const PROVIDERS: ProviderDefinition[] = [
  {
    type: "github",
    title: "GitHub",
    description: "用于站点用户及后台管理员通过 GitHub 登录",
    publicLabel: "Client ID",
    publicKey: "clientId",
    secretLabel: "Client Secret",
    secretKey: "clientSecret",
    icon: GithubIcon,
  },
  {
    type: "qq",
    title: "QQ",
    description: "通过中转服务登录；回调地址由“站点地址 → 后端服务地址”配置",
    icon: QQIcon,
  },
];

/** 将任意配置值收窄为可编辑对象。 */
const asRecord = (value: OptionValue | undefined): OptionRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as OptionRecord
    : {};

/** 读取 OAuth 提供商是否启用。 */
const isProviderEnabled = (value: OptionValue, providerType: string): boolean => {
  const providers = asRecord(value).providers;
  if (!Array.isArray(providers)) {
    return false;
  }
  return providers.some((provider) => {
    const record = asRecord(provider);
    return record.type === providerType && record.enabled === true;
  });
};

/** 读取 OAuth 嵌套字符串字段。 */
const getNestedString = (
  value: OptionValue,
  section: "public" | "secrets",
  providerType: string,
  field: string,
): string => {
  const root = asRecord(value);
  const provider = asRecord(asRecord(root[section])[providerType]);
  if (typeof provider[field] === "string") {
    return provider[field];
  }
  if (section === "secrets") {
    const legacyProvider = asRecord(asRecord(root.private)[providerType]);
    return typeof legacyProvider[field] === "string" ? legacyProvider[field] : "";
  }
  return "";
};

export const OAuthConfigSection = defineComponent({
  props: {
    value: { type: null as unknown as PropType<OptionValue>, required: true },
    onUpdate: { type: Function as PropType<(value: OptionValue) => void>, required: true },
  },
  setup(props) {
    /** 更新 Passkey 自动登录偏好，由外层统一保存 oauth 配置。 */
    const updatePasskeyAutomatic = (enabled: boolean) => {
      const nextValue = asRecord(cloneDeep(props.value));
      nextValue.passkeyAutomatic = enabled;
      props.onUpdate(nextValue);
    };

    /** 更新单个提供商开关，同时保留数据库中的其他提供商字段。 */
    const updateEnabled = (providerType: string, enabled: boolean) => {
      const nextValue = asRecord(cloneDeep(props.value));
      const providers = Array.isArray(nextValue.providers)
        ? nextValue.providers.map(provider => cloneDeep(provider))
        : [];
      const providerIndex = providers.findIndex(
        provider => asRecord(provider).type === providerType,
      );
      const nextProvider: OptionRecord = providerIndex >= 0
        ? asRecord(providers[providerIndex])
        : { type: providerType };
      nextProvider.enabled = enabled;
      if (providerIndex >= 0) {
        providers[providerIndex] = nextProvider;
      } else {
        providers.push(nextProvider);
      }
      nextValue.providers = providers;
      props.onUpdate(nextValue);
    };

    /** 更新凭据字段，同时保留完整 OAuth 文档结构。 */
    const updateCredential = (
      section: "public" | "secrets",
      providerType: string,
      field: string,
      value: string,
    ) => {
      const nextValue = asRecord(cloneDeep(props.value));
      const sectionValue = asRecord(nextValue[section]);
      const providerValue = asRecord(sectionValue[providerType]);
      providerValue[field] = value;
      sectionValue[providerType] = providerValue;
      nextValue[section] = sectionValue;
      props.onUpdate(nextValue);
    };

    return () => (
      <>
        <PasskeySecuritySection
          automatic={asRecord(props.value).passkeyAutomatic === true}
          onUpdateAutomatic={updatePasskeyAutomatic}
        />
        {PROVIDERS.map((provider) => {
          const ProviderIcon = provider.icon;
          return (
            <SettingsSection
              key={provider.type}
              title={provider.title}
              description={provider.description}
              icon={ProviderIcon}
            >
              <SettingsRow title="启用登录">
                <NSwitch
                  value={isProviderEnabled(props.value, provider.type)}
                  onUpdateValue={enabled => updateEnabled(provider.type, enabled)}
                />
              </SettingsRow>
              {provider.publicLabel && provider.publicKey && (
                <SettingsRow title={provider.publicLabel}>
                  <NInput
                    value={getNestedString(props.value, "public", provider.type, provider.publicKey)}
                    placeholder={`请输入 ${provider.publicLabel}`}
                    onUpdateValue={value => updateCredential("public", provider.type, provider.publicKey!, value)}
                  />
                </SettingsRow>
              )}
              {provider.secretLabel && provider.secretKey && (
                <SettingsRow title={provider.secretLabel}>
                  <NInput
                    value={getNestedString(props.value, "secrets", provider.type, provider.secretKey)}
                    type="password"
                    showPasswordOn="click"
                    placeholder={`请输入 ${provider.secretLabel}`}
                    onUpdateValue={value => updateCredential("secrets", provider.type, provider.secretKey!, value)}
                  />
                </SettingsRow>
              )}
            </SettingsSection>
          );
        })}
      </>
    );
  },
});
