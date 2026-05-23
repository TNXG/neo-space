import type { LucideIcon } from "lucide-vue-next";
import type { PropType } from "vue";
import type { FormDSL } from "~/components/config-form/types";
import {
  Bell as BellIcon,
  Database as DatabaseIcon,
  FileText as FileTextIcon,
  Globe as GlobeIcon,
  ListPlus as ListPlusIcon,
  Puzzle as PuzzleIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Shield as ShieldIcon,
  Sparkles as SparklesIcon,
  User as UserIcon,
} from "lucide-vue-next";
import { NScrollbar } from "naive-ui";
import { computed, defineComponent } from "vue";

export interface StaticGroup {
  key: string;
  title: string;
  description: string;
  icon: string;
}

const staticGroupsBefore: StaticGroup[] = [
  { key: "user", title: "用户", description: "个人资料", icon: "user" },
];

const staticGroupsAfter: StaticGroup[] = [
  {
    key: "account",
    title: "账号安全",
    description: "登录、认证、凭证",
    icon: "shield",
  },
  {
    key: "meta-preset",
    title: "Meta 预设",
    description: "预设模板",
    icon: "list-plus",
  },
];

const iconMap: Record<string, LucideIcon> = {
  "globe": GlobeIcon,
  "search": SearchIcon,
  "bell": BellIcon,
  "shield": ShieldIcon,
  "settings": SettingsIcon,
  "sparkles": SparklesIcon,
  "user": UserIcon,
  "list-plus": ListPlusIcon,
  "database": DatabaseIcon,
  "file-text": FileTextIcon,
  "puzzle": PuzzleIcon,
};

export const SettingListPanel = defineComponent({
  props: {
    activeGroupKey: {
      type: String,
      required: true,
    },
    systemSchema: {
      type: Object as PropType<FormDSL | null>,
      default: null,
    },
    onGroupChange: {
      type: Function as PropType<(key: string) => void>,
      required: true,
    },
  },
  setup(props) {
    const getGroupIcon = (iconName: string) => {
      return iconMap[iconName] || SettingsIcon;
    };

    const allGroups = computed(() => {
      const systemGroups = props.systemSchema?.groups || [];
      return [...staticGroupsBefore, ...systemGroups, ...staticGroupsAfter];
    });

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex h-12 items-center justify-between dark:border-neutral-800">
          <span class="text-base text-neutral-900 font-semibold dark:text-neutral-100">
            设置
          </span>
          <span class="text-xs text-neutral-400">
            {allGroups.value.length}
            {" "}
            项
          </span>
        </div>

        <div class="flex-1 min-h-0">
          <NScrollbar class="h-full">
            <ul class="m-0 p-0 list-none">
              {allGroups.value.map((group) => {
                const GroupIcon = getGroupIcon(group.icon);
                const isActive = props.activeGroupKey === group.key;
                return (
                  <li key={group.key}>
                    <button
                      class={[
                        "flex w-full cursor-pointer items-center gap-3 border-0 border-b border-neutral-100 bg-transparent px-4 py-3 text-left transition-colors last:border-b-0 dark:border-neutral-800/50",
                        isActive
                          ? "bg-neutral-100 dark:bg-neutral-800"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
                      ]}
                      onClick={() => props.onGroupChange(group.key)}
                      type="button"
                    >
                      <div
                        class={[
                          "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
                          isActive
                            ? "bg-primary/10 text-primary dark:bg-primary/20"
                            : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400",
                        ]}
                      >
                        <GroupIcon />
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
                          {group.title}
                        </div>
                        <div class="text-xs text-neutral-500 mt-0.5 truncate dark:text-neutral-400">
                          {group.description}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </NScrollbar>
        </div>
      </div>
    );
  },
});
