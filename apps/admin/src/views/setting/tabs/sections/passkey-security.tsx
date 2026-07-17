import type { PasskeySummary } from "~/api/passkey";
import type { PropType } from "vue";
import { KeyRound as PasskeyIcon, Trash2 as TrashIcon } from "lucide-vue-next";
import { NAlert, NButton, NInput, NPopconfirm, NSwitch } from "naive-ui";
import { defineComponent, onMounted, ref } from "vue";
import { toast } from "vue-sonner";

import { passkeyApi } from "~/api/passkey";
import { RelativeTime } from "~/components/time/relative-time";
import { SettingsRow, SettingsSection } from "~/layouts/settings-layout";

/** 集中管理 Passkey 初始化、凭据列表和登录触发方式。 */
export const PasskeySecuritySection = defineComponent({
  props: {
    automatic: { type: Boolean, required: true },
    onUpdateAutomatic: {
      type: Function as PropType<(enabled: boolean) => void>,
      required: true,
    },
  },
  setup(props) {
    const passkeys = ref<PasskeySummary[]>([]);
    const passkeyName = ref("");
    const loading = ref(false);
    const supported = passkeyApi.supports();

    /** 读取已注册凭据。 */
    const refresh = async () => {
      passkeys.value = await passkeyApi.list();
    };

    /** 使用用户填写名称或当前设备名称完成首次 WebAuthn 注册。 */
    const initializePasskey = async () => {
      if (!supported || loading.value)
        return;
      const defaultName = `${navigator.platform || "当前设备"} Passkey`;
      try {
        loading.value = true;
        await passkeyApi.register(passkeyName.value.trim() || defaultName);
        passkeyName.value = "";
        passkeys.value = await passkeyApi.list();
        toast.success("Passkey 初始化成功");
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "NotAllowedError")
          toast.info("已取消 Passkey 初始化");
        else toast.error(error instanceof Error ? error.message : "Passkey 初始化失败");
      } finally {
        loading.value = false;
      }
    };

    /** 删除指定凭据并同步列表。 */
    const deletePasskey = async (id: string) => {
      try {
        await passkeyApi.delete(id);
        passkeys.value = await passkeyApi.list();
        toast.success("Passkey 已删除");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Passkey 删除失败");
      }
    };

    onMounted(async () => {
      try {
        await refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Passkey 状态加载失败");
      }
    });

    return () => (
      <SettingsSection
        title="Passkey 登录"
        description="先在当前设备初始化 Passkey，再选择登录页自动请求或点击按钮后使用"
        icon={PasskeyIcon}
      >
        {!supported && (
          <NAlert type="warning" title="当前浏览器不支持 Passkey">
            请使用支持 WebAuthn 的现代浏览器完成初始化。
          </NAlert>
        )}

        {supported && passkeys.value.length === 0 && (
          <NAlert type="info" title="尚未初始化 Passkey">
            点击下方“初始化 Passkey”，按照浏览器提示使用 Touch ID、Windows Hello 或安全密钥完成注册。
          </NAlert>
        )}

        <SettingsRow title="初始化 Passkey" description="名称可选；留空时自动使用当前设备名称">
          <div class="flex gap-2 w-full">
            <NInput
              value={passkeyName.value}
              onInput={value => (passkeyName.value = value)}
              placeholder="可选：例如 MacBook Touch ID"
              disabled={!supported || loading.value}
              onKeyup={(event: KeyboardEvent) => {
                if (event.key === "Enter")
                  void initializePasskey();
              }}
            />
            <NButton
              type="primary"
              loading={loading.value}
              disabled={!supported}
              onClick={() => void initializePasskey()}
            >
              初始化
            </NButton>
          </div>
        </SettingsRow>

        <SettingsRow
          title="进入登录页自动启用"
          description="关闭时仍可通过登录页的 Passkey 按钮主动触发"
        >
          <NSwitch
            value={props.automatic}
            disabled={passkeys.value.length === 0 || loading.value}
            onUpdateValue={props.onUpdateAutomatic}
          />
        </SettingsRow>

        <SettingsRow title="已初始化设备">
          <div class="divide-neutral-100 divide-y w-full dark:divide-neutral-800">
            {passkeys.value.map(passkey => (
              <div key={passkey._id} class="py-3 flex gap-3 items-center">
                <PasskeyIcon class="text-neutral-500 size-4 shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-neutral-900 font-medium m-0 truncate dark:text-neutral-100">
                    {passkey.name}
                  </p>
                  <p class="text-xs text-neutral-400 mt-0.5 mb-0">
                    初始化于 <RelativeTime time={passkey.createdAt} />
                    {passkey.lastUsedAt && <> · 最近使用 <RelativeTime time={passkey.lastUsedAt} /></>}
                  </p>
                </div>
                <NPopconfirm
                  onPositiveClick={() => void deletePasskey(passkey._id)}
                  v-slots={{
                    trigger: () => (
                      <button
                        type="button"
                        aria-label={`删除 ${passkey.name}`}
                        class="text-neutral-400 rounded-md flex size-8 cursor-pointer items-center justify-center hover:text-red-500"
                      >
                        <TrashIcon class="size-4" />
                      </button>
                    ),
                    default: () => `确定删除 ${passkey.name}？`,
                  }}
                />
              </div>
            ))}
          </div>
        </SettingsRow>
      </SettingsSection>
    );
  },
});
