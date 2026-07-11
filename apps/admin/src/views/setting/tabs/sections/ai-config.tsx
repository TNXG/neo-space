import type { PropType } from "vue";
import type { ProviderModel } from "~/api/ai";
import {
  CircleCheck as CheckCircleOutlinedIcon,
  ChevronDown as ChevronDownIcon,
  Cpu as CpuIcon,
  Globe as GlobeIcon,
  Languages as LanguagesIcon,
  Plus as PlusIcon,
  Zap as ZapIcon,
} from "lucide-vue-next";
import {
  NButton,
  NInput,
  NSelect,
  NSpace,
  NSwitch,
} from "naive-ui";
import { computed, defineComponent, ref } from "vue";
import { toast } from "vue-sonner";

import { aiApi } from "~/api/ai";
import { HeaderActionButton } from "~/components/button/header-action-button";
import { DeleteConfirmButton } from "~/components/special-button/delete-confirm";
import { useAIModelsQuery, useUpdateModelsCache } from "~/hooks/queries/use-ai";
import { SettingsRow, SettingsSection } from "~/layouts/settings-layout";

enum AIProviderType {
  OpenAI = "openai",
  OpenAICompatible = "openai-compatible",
  Anthropic = "anthropic",
  OpenRouter = "openrouter",
}

interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  apiKey: string;
  endpoint?: string;
  defaultModel: string;
  enabled: boolean;
}

interface AIModelAssignment {
  providerId?: string;
  model?: string;
}

export interface AIConfig {
  providers: AIProviderConfig[];
  summaryModel?: AIModelAssignment;
  commentReviewModel?: AIModelAssignment;
  translationModel?: AIModelAssignment;
  enableSummary: boolean;
  enableTranslation?: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
  created?: number;
}

const AIProviderTypeOptions = [
  { label: "OpenAI", value: AIProviderType.OpenAI },
  {
    label: "OpenAI Compatible",
    value: AIProviderType.OpenAICompatible,
  },
  { label: "Anthropic", value: AIProviderType.Anthropic },
  { label: "OpenRouter", value: AIProviderType.OpenRouter },
];

const getProviderTypeLabel = (type: AIProviderType): string =>
  AIProviderTypeOptions.find(option => option.value === type)?.label || type;

const formatProviderLabel = (provider: AIProviderConfig): string => {
  const name = provider.name?.trim();
  const typeLabel = getProviderTypeLabel(provider.type);
  if (name) {
    return name;
  }
  return typeLabel;
};

const getDefaultModelForType = (type: AIProviderType): string => {
  switch (type) {
    case AIProviderType.Anthropic:
      return "claude-sonnet-4.5";
    case AIProviderType.OpenAI:
      return "gpt-5-mini";
    case AIProviderType.OpenRouter:
      return "anthropic/claude-sonnet-4.5";
    case AIProviderType.OpenAICompatible:
      return "";
    default:
      return "";
  }
};

const getNamePlaceholderForType = (type: AIProviderType): string => {
  switch (type) {
    case AIProviderType.Anthropic:
      return "如 Claude Sonnet";
    case AIProviderType.OpenAI:
      return "如 OpenAI GPT-4o";
    case AIProviderType.OpenRouter:
      return "如 OpenRouter";
    case AIProviderType.OpenAICompatible:
      return "如 DeepSeek";
    default:
      return "";
  }
};

const getModelPlaceholderForType = (type: AIProviderType): string => {
  switch (type) {
    case AIProviderType.Anthropic:
      return "如 claude-sonnet-4.5";
    case AIProviderType.OpenAI:
      return "如 gpt-5-mini";
    case AIProviderType.OpenRouter:
      return "如 anthropic/claude-sonnet-4.5";
    case AIProviderType.OpenAICompatible:
      return "如 deepseek-chat";
    default:
      return "";
  }
};

const AIProviderRow = defineComponent({
  props: {
    provider: {
      type: Object as PropType<AIProviderConfig>,
      required: true,
    },
    expanded: {
      type: Boolean,
      default: false,
    },
    onToggle: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onUpdate: {
      type: Function as PropType<(provider: AIProviderConfig) => void>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onTest: {
      type: Function as PropType<(provider: AIProviderConfig) => void>,
    },
    availableModels: {
      type: Array as PropType<ModelInfo[]>,
      default: () => [],
    },
    isLoadingModels: {
      type: Boolean,
      default: false,
    },
    isTesting: {
      type: Boolean,
      default: false,
    },
    onRefreshModels: {
      type: Function as PropType<() => void>,
    },
  },
  setup(props) {
    const handleChange = <K extends keyof AIProviderConfig>(
      field: K,
      value: AIProviderConfig[K],
    ) => {
      props.onUpdate({ ...props.provider, [field]: value });
    };

    const handleTypeChange = (type: AIProviderType) => {
      props.onUpdate({
        ...props.provider,
        type,
        defaultModel: getDefaultModelForType(type),
      });
    };

    const modelOptions = computed(() =>
      props.availableModels.map(m => ({
        label: m.name || m.id,
        value: m.id,
      })),
    );

    const showEndpoint = computed(
      () =>
        props.provider.type === AIProviderType.OpenAICompatible
        || props.provider.type === AIProviderType.OpenAI
        || props.provider.type === AIProviderType.OpenRouter,
    );

    const cardTitle = computed(() => {
      if (props.provider.name)
        return props.provider.name;
      return getProviderTypeLabel(props.provider.type);
    });

    const ProviderIcon = computed(() => {
      switch (props.provider.type) {
        case AIProviderType.OpenAI:
          return ZapIcon;
        case AIProviderType.Anthropic:
          return CpuIcon;
        case AIProviderType.OpenRouter:
          return GlobeIcon;
        default:
          return ZapIcon;
      }
    });

    return () => (
      <div class="group">
        <div
          class="px-4 py-3 flex gap-3 cursor-pointer transition-colors items-center hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
          onClick={() => props.onToggle()}
        >
          <div
            class={[
              "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
              props.provider.enabled
                ? "bg-primary/10 text-primary dark:bg-primary/20"
                : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800",
            ]}
          >
            <ProviderIcon.value class="size-4" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex gap-2 items-center">
              <span class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
                {cardTitle.value}
              </span>
              {props.provider.enabled && (
                <span class="text-xs text-emerald-600 font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 inline-flex items-center dark:text-emerald-400 dark:bg-emerald-500/10">
                  已启用
                </span>
              )}
            </div>
            <span class="text-xs text-neutral-500 dark:text-neutral-400">
              {props.provider.defaultModel || "未设置模型"}
            </span>
          </div>
          <div
            class="flex gap-1 items-center"
            onClick={e => e.stopPropagation()}
          >
            <div class="gap-1 hidden items-center group-hover:flex">
              <HeaderActionButton
                variant="success"
                icon={<CheckCircleOutlinedIcon />}
                name="测试"
                disabled={props.isTesting || !props.provider.defaultModel}
                onClick={() => props.onTest?.(props.provider)}
              />
              <DeleteConfirmButton
                onDelete={() => props.onDelete()}
                message="确定删除此 Provider？"
              />
            </div>
          </div>
          <ChevronDownIcon
            class={[
              "size-4 shrink-0 text-neutral-400 transition-transform duration-200",
              props.expanded ? "rotate-180" : "",
            ]}
          />
        </div>

        {props.expanded && (
          <div class="px-4 py-4 border-t border-neutral-100 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/30">
            <div class="gap-4 grid sm:grid-cols-2">
              <div class="space-y-1.5">
                <label class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                  服务类型
                </label>
                <NSelect
                  value={props.provider.type}
                  onUpdateValue={handleTypeChange}
                  options={AIProviderTypeOptions}
                  size="small"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                  显示名称
                </label>
                <NInput
                  value={props.provider.name}
                  onUpdateValue={(v: string) => handleChange("name", v)}
                  placeholder={getNamePlaceholderForType(
                    props.provider.type,
                  )}
                  size="small"
                />
              </div>

              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                  API Key
                </label>
                <NInput
                  type="password"
                  showPasswordOn="click"
                  value={props.provider.apiKey}
                  onUpdateValue={(v: string) => handleChange("apiKey", v)}
                  placeholder={
                    props.provider.type === AIProviderType.Anthropic
                      ? "sk-ant-..."
                      : props.provider.type === AIProviderType.OpenRouter
                        ? "sk-or-..."
                        : "sk-..."
                  }
                  size="small"
                />
              </div>

              {showEndpoint.value && (
                <div class="space-y-1.5 sm:col-span-2">
                  <label class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                    Endpoint
                  </label>
                  <NInput
                    value={props.provider.endpoint}
                    onUpdateValue={(v: string) => handleChange("endpoint", v)}
                    placeholder={
                      props.provider.type
                      === AIProviderType.OpenAICompatible
                        ? "必填，如 https://api.deepseek.com"
                        : props.provider.type === AIProviderType.OpenRouter
                          ? "可选，默认 https://openrouter.ai/api/v1"
                          : "可选，留空使用默认"
                    }
                    size="small"
                  />
                </div>
              )}

              <div class="space-y-1.5 sm:col-span-2">
                <label class="text-xs text-neutral-500 font-medium dark:text-neutral-400">
                  默认模型
                </label>
                <NSpace align="center" wrap={false}>
                  {props.availableModels.length > 0
                    ? (
                        <NSelect
                          value={props.provider.defaultModel}
                          onUpdateValue={(v: string) =>
                            handleChange("defaultModel", v)}
                          options={modelOptions.value}
                          filterable
                          tag
                          size="small"
                          class="min-w-[200px]"
                          placeholder="选择或输入模型名"
                        />
                      )
                    : (
                        <NInput
                          value={props.provider.defaultModel}
                          onUpdateValue={(v: string) =>
                            handleChange("defaultModel", v)}
                          placeholder={getModelPlaceholderForType(
                            props.provider.type,
                          )}
                          size="small"
                          class="min-w-[200px]"
                        />
                      )}
                  <NButton
                    tertiary
                    type="primary"
                    size="small"
                    loading={props.isLoadingModels}
                    onClick={() => props.onRefreshModels?.()}
                  >
                    获取模型
                  </NButton>
                </NSpace>
              </div>

              <div class="pt-2 flex items-center justify-between sm:col-span-2">
                <span class="text-sm text-neutral-700 dark:text-neutral-200">
                  启用此服务商
                </span>
                <NSwitch
                  value={props.provider.enabled}
                  onUpdateValue={(v: boolean) => handleChange("enabled", v)}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  },
});

const AIModelAssignmentRow = defineComponent({
  props: {
    label: { type: String, required: true },
    description: { type: String },
    assignment: {
      type: Object as PropType<AIModelAssignment | undefined>,
    },
    providers: {
      type: Array as PropType<AIProviderConfig[]>,
      required: true,
    },
    providerModels: {
      type: Object as PropType<Record<string, ModelInfo[]>>,
      default: () => ({}),
    },
    onUpdate: {
      type: Function as PropType<
        (assignment: AIModelAssignment | undefined) => void
      >,
      required: true,
    },
  },
  setup(props) {
    const selectedProviderId = computed(() => props.assignment?.providerId || "");
    const selectedProvider = computed(() =>
      props.providers.find(provider => provider.id === selectedProviderId.value),
    );
    const selectedModel = computed(() =>
      props.assignment?.model || selectedProvider.value?.defaultModel || "",
    );

    const providerOptions = computed(() =>
      props.providers.map(p => ({
        label: formatProviderLabel(p),
        value: p.id,
        disabled: !p.enabled,
      })),
    );

    const currentProviderModels = computed(() => {
      if (!selectedProviderId.value)
        return [];
      return props.providerModels[selectedProviderId.value] || [];
    });

    const modelOptions = computed(() => {
      const models = currentProviderModels.value.map(m => ({
        label: m.name || m.id,
        value: m.id,
      }));

      const provider = props.providers.find(
        p => p.id === selectedProviderId.value,
      );
      if (provider?.defaultModel) {
        const defaultExists = models.some(
          m => m.value === provider.defaultModel,
        );
        if (!defaultExists) {
          models.unshift({
            label: `${provider.defaultModel} (默认)`,
            value: provider.defaultModel,
          });
        }
      }

      return models;
    });

    const handleProviderChange = (providerId: string) => {
      const provider = props.providers.find(item => item.id === providerId);
      props.onUpdate(
        providerId
          ? { providerId, model: provider?.defaultModel || undefined }
          : undefined,
      );
    };

    const handleModelChange = (model: string) => {
      props.onUpdate(
        selectedProviderId.value
          ? { providerId: selectedProviderId.value, model: model || undefined }
          : undefined,
      );
    };

    return () => (
      <SettingsRow title={props.label} description={props.description}>
        <div class="flex flex-col gap-2 sm:flex-row">
          <NSelect
            value={selectedProviderId.value || null}
            onUpdateValue={handleProviderChange}
            options={providerOptions.value}
            placeholder="选择服务商"
            clearable
            class="w-full sm:w-40"
            size="small"
          />
          <NSelect
            value={selectedModel.value || null}
            onUpdateValue={handleModelChange}
            options={modelOptions.value}
            placeholder="选择具体模型"
            clearable
            filterable
            tag
            class="w-full sm:flex-1 sm:min-w-[200px]"
            size="small"
            disabled={!selectedProviderId.value}
          />
        </div>
        {selectedProvider.value && selectedModel.value && (
          <p class="text-xs text-neutral-500 mt-2 m-0 dark:text-neutral-400">
            当前使用：{formatProviderLabel(selectedProvider.value)} / {selectedModel.value}
          </p>
        )}
      </SettingsRow>
    );
  },
});

export const AIConfigSection = defineComponent({
  props: {
    value: {
      type: Object as PropType<AIConfig>,
      required: true,
    },
    onUpdate: {
      type: Function as PropType<(value: AIConfig) => void>,
      required: true,
    },
  },
  setup(props) {
    const loadingProviders = ref<Set<string>>(new Set());
    const testingProviders = ref<Set<string>>(new Set());

    const config = computed({
      get: () => props.value,
      set: val => props.onUpdate(val),
    });

    const hasEnabledProviders = computed(() =>
      config.value.providers?.some(p => p.enabled),
    );
    const { data: providerModels } = useAIModelsQuery(hasEnabledProviders);
    const updateModelsCache = useUpdateModelsCache();

    const fetchModelsForProvider = async (provider: AIProviderConfig) => {
      loadingProviders.value.add(provider.id);
      try {
        const response = await aiApi.getModelList({
          providerId: provider.id,
          type: provider.type,
          apiKey: provider.apiKey || undefined,
          endpoint: provider.endpoint || undefined,
        });
        if (response.models) {
          updateModelsCache(provider.id, response.models as ProviderModel[]);
        }
        if (response.error) {
          toast.warning(`获取模型列表: ${response.error}`);
        }
      } catch (error: any) {
        console.error(`Failed to fetch models for ${provider.id}:`, error);
        if (!error?.response) {
          toast.error(`获取模型列表失败: ${error.message || error}`);
        }
      } finally {
        loadingProviders.value.delete(provider.id);
      }
    };

    const testProviderConnection = async (provider: AIProviderConfig) => {
      if (!provider.defaultModel) {
        toast.warning("请先填写默认模型");
        return;
      }

      testingProviders.value.add(provider.id);
      try {
        await aiApi.testConfig({
          providerId: provider.id,
          type: provider.type,
          apiKey: provider.apiKey || undefined,
          endpoint: provider.endpoint || undefined,
          model: provider.defaultModel || undefined,
        });
        toast.success("连接可用");
      } catch (error: any) {
        console.error(`Failed to test provider ${provider.id}:`, error);
        if (!error?.response) {
          toast.error(`连接失败: ${error.message || error}`);
        }
      } finally {
        testingProviders.value.delete(provider.id);
      }
    };

    const updateConfig = (partial: Partial<AIConfig>) => {
      props.onUpdate({ ...config.value, ...partial });
    };

    const handleProviderUpdate = (
      index: number,
      provider: AIProviderConfig,
    ) => {
      const newProviders = [...(config.value.providers || [])];
      newProviders[index] = provider;
      updateConfig({ providers: newProviders });
    };

    const handleProviderDelete = (index: number) => {
      const newProviders = (config.value.providers || []).filter(
        (_, i) => i !== index,
      );
      updateConfig({ providers: newProviders });
    };

    const expandedProviders = ref<Set<string>>(new Set());

    const toggleProvider = (id: string) => {
      if (expandedProviders.value.has(id)) {
        expandedProviders.value.delete(id);
      } else {
        expandedProviders.value.add(id);
      }
    };

    const handleAddProvider = () => {
      const defaultType = AIProviderType.OpenAI;
      const newProvider: AIProviderConfig = {
        id: crypto.randomUUID(),
        name: "",
        type: defaultType,
        apiKey: "",
        defaultModel: getDefaultModelForType(defaultType),
        enabled: true,
      };
      updateConfig({
        providers: [...(config.value.providers || []), newProvider],
      });
      expandedProviders.value.add(newProvider.id);
    };

    return () => (
      <div class="space-y-8">
        <SettingsSection
          title="AI 服务商"
          description="配置 AI 服务提供商"
          icon={ZapIcon}
          v-slots={{
            actions: () => (
              <NButton
                size="small"
                secondary
                type="primary"
                onClick={handleAddProvider}
              >
                <PlusIcon class="mr-1 size-4" />
                添加
              </NButton>
            ),
          }}
        >
          {config.value.providers && config.value.providers.length > 0
            ? (
                config.value.providers.map((provider, index) => (
                  <AIProviderRow
                    key={provider.id}
                    provider={provider}
                    expanded={expandedProviders.value.has(provider.id)}
                    onToggle={() => toggleProvider(provider.id)}
                    onUpdate={p => handleProviderUpdate(index, p)}
                    onDelete={() => handleProviderDelete(index)}
                    onTest={p => testProviderConnection(p)}
                    availableModels={providerModels.value?.[provider.id] || []}
                    isLoadingModels={loadingProviders.value.has(provider.id)}
                    isTesting={testingProviders.value.has(provider.id)}
                    onRefreshModels={() => fetchModelsForProvider(provider)}
                  />
                ))
              )
            : (
                <div class="py-10 text-center flex flex-col items-center justify-center">
                  <div class="text-neutral-400 mb-3 rounded-full bg-neutral-100 flex size-12 items-center justify-center dark:text-neutral-500 dark:bg-neutral-800">
                    <ZapIcon class="size-6" />
                  </div>
                  <p class="text-sm text-neutral-500 dark:text-neutral-400">
                    暂无服务商，点击添加按钮创建
                  </p>
                </div>
              )}
        </SettingsSection>

        <SettingsSection
          title="评论 AI 审核"
          description="明确指定垃圾评论审核使用的服务商与具体模型"
          icon={CpuIcon}
        >
          <AIModelAssignmentRow
            label="审核模型"
            description="评论反垃圾只会使用这里指定的模型，不再自动选择第一个服务商"
            assignment={config.value.commentReviewModel}
            providers={config.value.providers || []}
            providerModels={providerModels.value || {}}
            onUpdate={a => updateConfig({ commentReviewModel: a })}
          />
        </SettingsSection>

        <SettingsSection
          title="内容模型"
          description="为摘要与翻译功能分配模型"
          icon={CpuIcon}
        >
          <AIModelAssignmentRow
            label="摘要功能"
            description="用于生成文章摘要的模型"
            assignment={config.value.summaryModel}
            providers={config.value.providers || []}
            providerModels={providerModels.value || {}}
            onUpdate={a => updateConfig({ summaryModel: a })}
          />

          <AIModelAssignmentRow
            label="翻译功能"
            description="用于生成文章翻译的模型"
            assignment={config.value.translationModel}
            providers={config.value.providers || []}
            providerModels={providerModels.value || {}}
            onUpdate={a => updateConfig({ translationModel: a })}
          />

        </SettingsSection>

        <SettingsSection
          title="功能开关"
          description="AI 功能的启用与配置"
          icon={GlobeIcon}
        >
          <SettingsRow title="启用 AI 摘要">
            <NSwitch
              value={config.value.enableSummary}
              onUpdateValue={(v: boolean) => updateConfig({ enableSummary: v })}
            />
          </SettingsRow>

        </SettingsSection>

        <SettingsSection
          title="AI 翻译"
          description="文章多语言翻译功能配置"
          icon={LanguagesIcon}
        >
          <SettingsRow title="启用 AI 翻译">
            <NSwitch
              value={config.value.enableTranslation}
              onUpdateValue={(v: boolean) =>
                updateConfig({ enableTranslation: v })}
            />
          </SettingsRow>

        </SettingsSection>
      </div>
    );
  },
});
