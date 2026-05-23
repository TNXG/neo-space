import type { FormDSL } from "~/components/config-form/types";
import { Save as SaveIcon, Settings as SettingsIcon } from "lucide-vue-next";
import { NButton } from "naive-ui";
import {
  computed,
  defineComponent,
  onBeforeMount,
  onUnmounted,
  ref,
  watchEffect,
} from "vue";
import { useRoute, useRouter } from "vue-router";

import { optionsApi } from "~/api/options";
import { MasterDetailLayout, useMasterDetailLayout } from "~/components/layout";
import { useLayout } from "~/hooks/use-layout";
import { SettingsDetailPanel } from "~/layouts/settings-layout";

import { SettingListPanel } from "./components/SettingListPanel";
import { TabAccount } from "./tabs/account";
import { TabMetaPresets } from "./tabs/meta-presets";
import { TabSystem } from "./tabs/system";
import { TabUser } from "./tabs/user";

const staticGroupKeys = ["user", "account", "meta-preset"];

const staticGroupTitles: Record<string, string> = {
  "user": "用户",
  "account": "账号安全",
  "meta-preset": "Meta 预设",
};

const staticComponentMap: Record<string, ReturnType<typeof defineComponent>> = {
  "user": TabUser,
  "account": TabAccount,
  "meta-preset": TabMetaPresets,
};

export default defineComponent({
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { setActions } = useLayout();
    const { isMobile } = useMasterDetailLayout();

    const systemSchema = ref<FormDSL | null>(null);
    const systemTabRef = ref<any>(null);
    const dirtyInfo = ref<{ isDirty: boolean; count: number }>({
      isDirty: false,
      count: 0,
    });
    const showDetailOnMobile = ref(false);

    const activeGroupKey = computed(() => {
      const queryGroup = route.query.group as string;
      if (queryGroup) {
        const isStaticGroup = staticGroupKeys.includes(queryGroup);
        const isSystemGroup = systemSchema.value?.groups?.some(
          g => g.key === queryGroup,
        );
        if (isStaticGroup || isSystemGroup) {
          return queryGroup;
        }
      }
      return "user";
    });

    onBeforeMount(async () => {
      try {
        systemSchema.value = await optionsApi.getFormSchema();
      } catch (e) {
        console.error("Failed to load system schema", e);
      }
    });

    const handleGroupChange = (groupKey: string) => {
      router.replace({
        name: route.name as string,
        query: { group: groupKey },
      });
      if (isMobile.value) {
        showDetailOnMobile.value = true;
      }
    };

    const handleMobileBack = () => {
      showDetailOnMobile.value = false;
    };

    const isSystemGroup = computed(() => {
      return (
        systemSchema.value?.groups?.some(
          g => g.key === activeGroupKey.value,
        ) ?? false
      );
    });

    const activeGroup = computed(() => {
      if (!systemSchema.value?.groups)
        return null;
      return systemSchema.value.groups.find(
        g => g.key === activeGroupKey.value,
      );
    });

    const activeGroupTitle = computed(() => {
      if (staticGroupTitles[activeGroupKey.value]) {
        return staticGroupTitles[activeGroupKey.value];
      }
      return activeGroup.value?.title ?? "设置";
    });

    const handleDirtyInfoUpdate = (info: {
      isDirty: boolean;
      count: number;
    }) => {
      dirtyInfo.value = info;
    };

    const handleSaveAll = async () => {
      if (systemTabRef.value?.saveAll) {
        await systemTabRef.value.saveAll();
      }
    };

    watchEffect(() => {
      const { isDirty, count } = dirtyInfo.value;

      if (isSystemGroup.value && isDirty) {
        setActions(
          <div class="flex gap-3 items-center">
            <span class="text-sm text-neutral-600 hidden dark:text-neutral-400 md:inline">
              你有
              {" "}
              {count}
              {" "}
              项未保存的修改
            </span>
            <NButton
              type="primary"
              size="small"
              onClick={handleSaveAll}
              renderIcon={() => <SaveIcon size={16} />}
            >
              保存全部
            </NButton>
          </div>,
        );
      } else {
        setActions(null);
      }
    });

    onUnmounted(() => {
      setActions(null);
    });

    const EmptyState = () => (
      <div class="text-center bg-neutral-50 flex flex-col h-full items-center justify-center dark:bg-neutral-950">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <SettingsIcon class="text-neutral-400 size-8" />
        </div>
        <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">
          选择一个设置项
        </h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          从左侧列表选择查看详情
        </p>
      </div>
    );

    const DetailContent = () => {
      const StaticComponent = staticComponentMap[activeGroupKey.value];

      if (activeGroupKey.value === "account") {
        return (
          <div class="flex flex-col h-full">
            <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center dark:border-neutral-800">
              <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
                {activeGroupTitle.value}
              </h2>
            </div>
            <div class="flex-1 min-h-0">
              <TabAccount />
            </div>
          </div>
        );
      }

      return (
        <SettingsDetailPanel
          title={activeGroupTitle.value}
          onBack={handleMobileBack}
        >
          <TabSystem
            ref={systemTabRef}
            activeGroup={activeGroup.value}
            schema={systemSchema.value}
            style={{ display: isSystemGroup.value ? undefined : "none" }}
            {...{ "onUpdate:dirty-info": handleDirtyInfoUpdate }}
          />
          {!isSystemGroup.value && StaticComponent && <StaticComponent />}
        </SettingsDetailPanel>
      );
    };

    return () => (
      <MasterDetailLayout
        showDetailOnMobile={showDetailOnMobile.value}
        defaultSize="250px"
        min="200px"
        max="400px"
      >
        {{
          list: () => (
            <SettingListPanel
              activeGroupKey={activeGroupKey.value}
              systemSchema={systemSchema.value}
              onGroupChange={handleGroupChange}
            />
          ),
          detail: () => <DetailContent />,
          empty: () => <EmptyState />,
        }}
      </MasterDetailLayout>
    );
  },
});
