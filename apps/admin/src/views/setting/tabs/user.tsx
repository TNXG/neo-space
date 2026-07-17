import type { UserModel } from "~/models/user";
import { useMutation } from "@tanstack/vue-query";
import { cloneDeep, isEmpty } from "es-toolkit/compat";
import {
  Calendar as CalendarIcon,
  Camera as CameraIcon,
  CircleCheck as CheckCircleOutlinedIcon,
  Globe as GlobeIcon,
  Link as LinkIcon,
  Mail as MailIcon,
  Plus as PlusIcon,
  Trash2 as TrashIcon,
  User as UserIcon,
} from "lucide-vue-next";
import { NButton, NInput, NSelect, NSkeleton } from "naive-ui";
import {
  computed,
  defineComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  unref,
  watch,
} from "vue";

import { toast } from "vue-sonner";

import { userApi } from "~/api/user";
import Avatar from "~/components/avatar";
import { HeaderActionButton } from "~/components/button/header-action-button";
import { IpInfoPopover } from "~/components/ip-info";
import { RelativeTime } from "~/components/time/relative-time";
import { UploadWrapper } from "~/components/upload";
import { socialKeyMap } from "~/constants/social";
import { useLayout } from "~/layouts/content";
import { SettingsRow, SettingsSection } from "~/layouts/settings-layout";
import { deepDiff } from "~/utils";

export const TabUser = defineComponent(() => {
  const data = ref({} as UserModel);
  const loading = ref(true);
  let origin: UserModel;

  async function fetchOwner() {
    loading.value = true;
    const response = await userApi.getOwner();
    data.value = response;
    origin = cloneDeep(response);
    loading.value = false;
  }

  onMounted(async () => {
    await fetchOwner();
  });
  const diff = computed(() => deepDiff(origin, data.value));
  const hasChanges = computed(() => !isEmpty(diff.value));

  const { setActions: setHeaderButton } = useLayout();

  const updateMutation = useMutation({
    mutationFn: userApi.updateOwner,
    onSuccess: async () => {
      toast.success("保存成功");
      await fetchOwner();
    },
  });

  const handleSave = () => {
    if (!hasChanges.value)
      return;

    const submitData = cloneDeep(unref(diff));
    if (submitData.socialIds) {
      submitData.socialIds = data.value.socialIds;
    }

    updateMutation.mutate(submitData);
  };

  onMounted(() => {
    setHeaderButton(
      <HeaderActionButton
        disabled={true}
        onClick={handleSave}
        icon={<CheckCircleOutlinedIcon />}
      />,
    );
  });

  onBeforeUnmount(() => {
    setHeaderButton(null);
  });

  watch(
    () => hasChanges.value,
    (canSave) => {
      setHeaderButton(
        <HeaderActionButton
          disabled={!canSave}
          icon={<CheckCircleOutlinedIcon />}
          onClick={handleSave}
        />,
      );
    },
  );

  const socialOptions = Object.keys(socialKeyMap).map(key => ({
    label: key,
    value: socialKeyMap[key],
  }));

  const socialEntries = computed(() => {
    const ids = data.value.socialIds || {};
    return Object.entries(ids).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  });

  const usedSocialKeys = computed(
    () => new Set(socialEntries.value.map(e => e.key)),
  );

  const addSocialEntry = () => {
    const currentIds = data.value.socialIds || {};
    const availableKey
      = socialOptions.find(o => !usedSocialKeys.value.has(o.value))?.value || "";
    if (!availableKey)
      return;
    data.value.socialIds = { ...currentIds, [availableKey]: "" };
  };

  const updateSocialKey = (oldKey: string, newKey: string) => {
    if (oldKey === newKey)
      return;
    const ids = { ...data.value.socialIds };
    const value = ids[oldKey];
    delete ids[oldKey];
    ids[newKey] = value;
    data.value.socialIds = ids;
  };

  const updateSocialValue = (key: string, value: string) => {
    data.value.socialIds = { ...data.value.socialIds, [key]: value };
  };

  const removeSocialEntry = (key: string) => {
    const ids = { ...data.value.socialIds };
    delete ids[key];
    data.value.socialIds = ids;
  };

  const handleAvatarUpload: import("naive-ui").UploadOnFinish = (e) => {
    const res = JSON.parse((e.event?.target as XMLHttpRequest).responseText);
    e.file.url = res.url;
    data.value.avatar = res.url;
    return e.file;
  };

  return () => (
    <div class="space-y-8">
      {loading.value ? (
        <UserSkeleton />
      ) : (
        <>
          {/* Profile Header */}
          <div class="pb-6 flex gap-5 items-center">
            <div class="shrink-0 size-[80px] relative [&_.n-upload-trigger]:rounded-full [&_.n-upload]:rounded-full [&_.n-upload-trigger]:size-[80px] [&_.n-upload]:size-[80px] [&_.n-upload-trigger]:overflow-hidden [&_.n-upload]:overflow-hidden">
              <UploadWrapper
                onFinish={handleAvatarUpload}
                type="avatar"
                v-slots={{
                  default: () => (
                    <div class="rounded-full size-[80px] ring-4 ring-neutral-100 transition-all relative overflow-hidden dark:ring-neutral-800 hover:ring-primary/30 dark:hover:ring-primary/30">
                      <Avatar src={data.value.avatar} size={80} />
                      <div class="bg-black/50 opacity-0 flex transition-opacity items-center inset-0 justify-center absolute hover:opacity-100">
                        <CameraIcon class="text-white size-5" />
                      </div>
                    </div>
                  ),
                }}
              />
            </div>

            <div class="flex-1 min-w-0">
              <h2 class="text-lg text-neutral-900 font-semibold m-0 dark:text-neutral-100">
                {data.value.name || "–"}
              </h2>
              <p class="text-sm text-neutral-500 m-0 mt-0.5 dark:text-neutral-400">
                @
                {data.value.username}
              </p>
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 items-center">
                {data.value.mail && (
                  <span class="text-xs text-neutral-500 flex shrink-0 gap-1.5 items-center dark:text-neutral-400">
                    <MailIcon class="size-3.5" />
                    {data.value.mail}
                  </span>
                )}
                {data.value.lastLoginTime && (
                  <span class="text-xs text-neutral-500 flex shrink-0 gap-1.5 items-center dark:text-neutral-400">
                    <CalendarIcon class="size-3.5" />
                    上次登录:
                    {" "}
                    <RelativeTime time={data.value.lastLoginTime} />
                  </span>
                )}
                {data.value.lastLoginIp && (
                  <span class="text-xs text-neutral-500 flex shrink-0 gap-1.5 items-center dark:text-neutral-400">
                    <GlobeIcon class="size-3.5" />
                    <IpInfoPopover
                      ip={data.value.lastLoginIp}
                      triggerEl={(
                        <NButton quaternary size="tiny" type="primary">
                          {data.value.lastLoginIp}
                        </NButton>
                      )}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Basic Info Section */}
          <SettingsSection title="基本信息" icon={UserIcon}>
            <SettingsRow title="昵称">
              <NInput
                value={data.value.name}
                onInput={v => (data.value.name = v)}
                placeholder="输入昵称…"
                inputProps={{
                  id: "user-name",
                  autocomplete: "name",
                }}
              />
            </SettingsRow>

            <SettingsRow title="用户名">
              <NInput
                value={data.value.username}
                onInput={v => (data.value.username = v)}
                placeholder="输入用户名…"
                inputProps={{
                  id: "user-username",
                  autocomplete: "username",
                  spellcheck: false,
                }}
              />
            </SettingsRow>

            <SettingsRow title="邮箱">
              <NInput
                value={data.value.mail}
                onInput={v => (data.value.mail = v)}
                placeholder="输入邮箱地址…"
                inputProps={{
                  id: "user-mail",
                  type: "email",
                  inputmode: "email",
                  autocomplete: "email",
                  spellcheck: false,
                }}
              />
            </SettingsRow>

            <SettingsRow title="个人网站">
              <NInput
                value={data.value.url}
                onInput={v => (data.value.url = v)}
                placeholder="https://example.com"
                inputProps={{
                  id: "user-url",
                  type: "url",
                  inputmode: "url",
                  autocomplete: "url",
                  spellcheck: false,
                }}
              />
            </SettingsRow>

            <SettingsRow title="个人简介">
              <NInput
                value={data.value.introduce}
                onInput={v => (data.value.introduce = v)}
                type="textarea"
                placeholder="介绍一下自己…"
                autosize={{ minRows: 3, maxRows: 6 }}
                inputProps={{
                  id: "user-introduce",
                }}
              />
            </SettingsRow>

            <SettingsRow
              title="头像 URL"
              description="也可以点击上方头像直接上传图片"
            >
              <NInput
                value={data.value.avatar}
                onInput={v => (data.value.avatar = v)}
                placeholder="https://example.com/avatar.jpg"
                inputProps={{
                  id: "user-avatar",
                  type: "url",
                  inputmode: "url",
                  spellcheck: false,
                }}
              />
            </SettingsRow>
          </SettingsSection>

          {/* Social Links Section */}
          <SettingsSection
            title="社交链接"
            icon={LinkIcon}
            v-slots={{
              actions: () => (
                <NButton
                  size="small"
                  secondary
                  onClick={addSocialEntry}
                  disabled={
                    !socialOptions.some(
                      o => !usedSocialKeys.value.has(o.value),
                    )
                  }
                >
                  <PlusIcon class="mr-1 size-4" />
                  添加
                </NButton>
              ),
            }}
          >
            {socialEntries.value.length === 0
              ? (
                  <div class="text-sm text-neutral-400 py-8 text-center dark:text-neutral-500">
                    暂未添加任何社交链接
                  </div>
                )
              : (
                  <div class="divide-neutral-100 divide-y dark:divide-neutral-800">
                    {socialEntries.value.map(({ key, value }) => (
                      <div class="py-3 flex gap-3 items-center" key={key}>
                        <NSelect
                          class="shrink-0 w-36"
                          value={key}
                          options={socialOptions.map(opt => ({
                            ...opt,
                            disabled:
                          usedSocialKeys.value.has(opt.value)
                          && opt.value !== key,
                          }))}
                          onUpdateValue={newKey => updateSocialKey(key, newKey)}
                        />
                        <NInput
                          class="flex-1 min-w-0"
                          value={value}
                          onInput={v => updateSocialValue(key, v)}
                          placeholder="输入链接或 ID…"
                          inputProps={{ spellcheck: false }}
                        />
                        <button
                          type="button"
                          class="text-neutral-400 border-0 rounded-lg bg-transparent flex shrink-0 size-8 cursor-pointer transition-colors items-center justify-center dark:text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                          onClick={() => removeSocialEntry(key)}
                        >
                          <TrashIcon class="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
          </SettingsSection>
        </>
      )}
    </div>
  );
});

const UserSkeleton = defineComponent(() => {
  return () => (
    <div class="space-y-8">
      <div class="pb-6 flex gap-5 items-center">
        <NSkeleton circle style={{ width: "80px", height: "80px" }} />
        <div class="flex-1 min-w-0">
          <NSkeleton text style={{ width: "120px", height: "24px" }} />
          <NSkeleton
            text
            style={{ width: "80px", height: "16px", marginTop: "4px" }}
          />
          <div class="mt-2 flex gap-4">
            <NSkeleton text style={{ width: "150px" }} />
            <NSkeleton text style={{ width: "120px" }} />
          </div>
        </div>
      </div>
      <div>
        <NSkeleton text style={{ width: "80px", height: "20px" }} />
        <div class="mt-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} class="flex gap-8">
              <NSkeleton text style={{ width: "80px", height: "16px" }} />
              <NSkeleton text style={{ width: "100%", height: "34px" }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
