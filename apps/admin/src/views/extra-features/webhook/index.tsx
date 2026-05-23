import type { ComputedRef, PropType, VNode } from "vue";
import type { WebhookEventRecord, WebhookModel } from "~/api/webhooks";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/vue-query";
import { cloneDeep } from "es-toolkit/compat";
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink as ExternalLinkIcon,
  Globe,
  Pencil as PencilIcon,
  Play as PlayIcon,
  Plus as PlusIcon,
  RefreshCw as RefreshIcon,
  Shield,
  Trash2 as TrashIcon,
  Webhook as WebhookIcon,
} from "lucide-vue-next";
import {
  NButton,
  NCheckbox,
  NDrawer,
  NDrawerContent,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NInput,
  NLayoutContent,
  NPagination,
  NPopconfirm,
  NScrollbar,
  NSwitch,
  NTag,
  NTooltip,
} from "naive-ui";
import { computed, defineComponent, ref, watch, watchEffect } from "vue";

import { toast } from "vue-sonner";

import { webhooksApi } from "~/api/webhooks";
import { HeaderActionButton } from "~/components/button/header-action-button";
import {
  MasterDetailLayout,
  SplitPanel,
  useMasterDetailLayout,
} from "~/components/layout";
import { queryKeys } from "~/hooks/queries/keys";
import { useLayout } from "~/layouts/content";
import { EventScope } from "~/models/wehbook";

const getScopeText = (scope: number) => {
  const scopes: string[] = [];
  if ((scope & EventScope.TO_VISITOR) === EventScope.TO_VISITOR)
    scopes.push("访客");
  if ((scope & EventScope.TO_ADMIN) === EventScope.TO_ADMIN)
    scopes.push("管理员");
  if ((scope & EventScope.TO_SYSTEM) === EventScope.TO_SYSTEM)
    scopes.push("系统");
  return scopes.join(", ") || "未指定";
};

const getEventColor = (event: string) => {
  if (event === "all")
    return "info" as const;
  if (event.includes("create"))
    return "success" as const;
  if (event.includes("update"))
    return "warning" as const;
  if (event.includes("delete"))
    return "error" as const;
  return "default" as const;
};

export default defineComponent({
  setup() {
    const queryClient = useQueryClient();
    const { setActions } = useLayout();
    const { isMobile } = useMasterDetailLayout();

    const {
      data: webhooksData,
      isLoading,
      refetch,
    } = useQuery({
      queryKey: queryKeys.webhooks.list(),
      queryFn: () => webhooksApi.getList(),
    });

    const webhooks = computed(() => webhooksData.value ?? []);

    const selectedId = ref<string | null>(null);
    const showDetailOnMobile = ref(false);

    const selectedWebhook = computed(() =>
      webhooks.value.find(w => w.id === selectedId.value),
    );

    const createMutation = useMutation({
      mutationFn: webhooksApi.create,
      onSuccess: () => {
        toast.success("Webhook 创建成功");
        queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
        drawerVisible.value = false;
        editingWebhook.value = undefined;
      },
    });

    const updateMutation = useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<WebhookModel> }) =>
        webhooksApi.update(id, data),
      onSuccess: () => {
        toast.success("Webhook 更新成功");
        queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
        drawerVisible.value = false;
        editingWebhook.value = undefined;
      },
    });

    const deleteMutation = useMutation({
      mutationFn: webhooksApi.delete,
      onSuccess: () => {
        toast.success("Webhook 已删除");
        queryClient.invalidateQueries({ queryKey: queryKeys.webhooks.all });
      },
    });

    const testMutation = useMutation({
      mutationFn: ({ id, event }: { id: string; event: string }) =>
        webhooksApi.test(id, event),
      onSuccess: () => {
        toast.success("测试请求已发送");
      },
      onError: () => {
        toast.error("测试请求发送失败");
      },
    });

    const drawerVisible = ref(false);
    const editingWebhook = ref<WebhookModel | undefined>();

    const handleCreate = () => {
      editingWebhook.value = undefined;
      drawerVisible.value = true;
    };

    const handleEdit = (webhook: WebhookModel) => {
      editingWebhook.value = webhook;
      drawerVisible.value = true;
    };

    const handleSubmit = (data: Partial<WebhookModel>) => {
      if (editingWebhook.value?.id) {
        const submitData = { ...data };
        if (!submitData.secret) {
          delete submitData.secret;
        }
        updateMutation.mutate({
          id: editingWebhook.value.id,
          data: submitData,
        });
      } else {
        createMutation.mutate(data as any);
      }
    };

    const handleDelete = (id: string) => {
      deleteMutation.mutate(id);
      if (selectedId.value === id) {
        selectedId.value = null;
        showDetailOnMobile.value = false;
      }
    };

    const handleTest = (id: string, event: string) => {
      testMutation.mutate({ id, event });
    };

    const handleSelect = (webhook: WebhookModel) => {
      selectedId.value = webhook.id;
      if (isMobile.value) {
        showDetailOnMobile.value = true;
      }
    };

    const handleBack = () => {
      showDetailOnMobile.value = false;
    };

    watchEffect(() => {
      setActions(
        <>
          <HeaderActionButton
            icon={<RefreshIcon />}
            onClick={() => refetch()}
            name="刷新"
          />
          <HeaderActionButton
            icon={<PlusIcon />}
            onClick={handleCreate}
            name="添加 Webhook"
            variant="primary"
          />
        </>,
      );
    });

    return () => (
      <>
        <MasterDetailLayout
          showDetailOnMobile={showDetailOnMobile.value}
          defaultSize="350px"
          min="300px"
          max="400px"
        >
          {{
            list: () => (
              <WebhookListPanel
                data={webhooks.value}
                loading={isLoading.value}
                selectedId={selectedId.value}
                onSelect={handleSelect}
                onCreate={handleCreate}
              />
            ),
            detail: () =>
              selectedWebhook.value
                ? (
                    <SplitPanel
                      direction="horizontal"
                      defaultSize={0.55}
                      min={0.35}
                      max={0.75}
                      class="h-full"
                    >
                      <WebhookDetailPanel
                        webhook={selectedWebhook.value!}
                        isMobile={isMobile.value}
                        onBack={handleBack}
                        onEdit={() => handleEdit(selectedWebhook.value!)}
                        onDelete={() => handleDelete(selectedWebhook.value!.id)}
                        onTest={event =>
                          handleTest(selectedWebhook.value!.id, event)}
                      />
                      <WebhookDispatchPanel webhookId={selectedWebhook.value!.id} />
                    </SplitPanel>
                  )
                : null,
            empty: () => <WebhookDetailEmptyState />,
          }}
        </MasterDetailLayout>

        <WebhookEditDrawer
          show={drawerVisible.value}
          formData={editingWebhook.value}
          onClose={() => {
            drawerVisible.value = false;
            editingWebhook.value = undefined;
          }}
          onSubmit={handleSubmit}
        />
      </>
    );
  },
});

const StatusIndicator = defineComponent({
  props: {
    enabled: { type: Boolean, required: true },
  },
  setup(props) {
    return () => (
      <div class="flex shrink-0 items-center justify-center relative">
        {props.enabled && (
          <span class="rounded-full bg-green-400 opacity-75 inline-flex size-2 absolute animate-ping" />
        )}
        <span
          class={[
            "relative inline-flex size-2 rounded-full",
            props.enabled ? "bg-green-500" : "bg-neutral-400",
          ]}
        />
      </div>
    );
  },
});

const WebhookListPanel = defineComponent({
  props: {
    data: { type: Array as PropType<WebhookModel[]>, required: true },
    loading: { type: Boolean, default: false },
    selectedId: { type: String as PropType<string | null>, default: null },
    onSelect: {
      type: Function as PropType<(webhook: WebhookModel) => void>,
      required: true,
    },
    onCreate: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    const enabledCount = computed(
      () => props.data.filter(w => w.enabled).length,
    );

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex h-12 items-center justify-between dark:border-neutral-800">
          <span class="text-base text-neutral-900 font-semibold dark:text-neutral-100">
            Webhooks
          </span>
          <span class="text-xs text-neutral-400">
            {enabledCount.value}
            /
            {props.data.length}
            {" "}
            启用
          </span>
        </div>

        <div class="flex-1 min-h-0">
          {props.loading
            ? (
                <div class="py-24 flex items-center justify-center">
                  <div class="border-2 border-neutral-300 border-t-neutral-900 rounded-full size-6 animate-spin dark:border-neutral-700 dark:border-t-white" />
                </div>
              )
            : props.data.length === 0
              ? (
                  <WebhookListEmptyState onCreate={props.onCreate} />
                )
              : (
                  <NScrollbar class="h-full">
                    {props.data.map(webhook => (
                      <div
                        key={webhook.id}
                        class={[
                          "flex cursor-pointer items-center gap-3 border-b border-neutral-100 px-4 py-3",
                          "transition-colors last:border-b-0 dark:border-neutral-800/50",
                          props.selectedId === webhook.id
                            ? "bg-neutral-100 dark:bg-neutral-800"
                            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
                        ]}
                        onClick={() => props.onSelect(webhook)}
                      >
                        <StatusIndicator enabled={webhook.enabled} />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
                            {webhook.payloadUrl || webhook.url}
                          </div>
                          <div class="text-xs text-neutral-400 mt-0.5 flex gap-2 items-center dark:text-neutral-500">
                            <span>
                              {webhook.events.length}
                              {" "}
                              个事件
                            </span>
                            <span>·</span>
                            <span>{getScopeText(webhook.scope)}</span>
                          </div>
                        </div>
                        <NTag
                          size="small"
                          type={webhook.enabled ? "success" : "default"}
                          bordered={false}
                          round
                        >
                          {webhook.enabled ? "启用" : "禁用"}
                        </NTag>
                      </div>
                    ))}
                  </NScrollbar>
                )}
        </div>
      </div>
    );
  },
});

const WebhookDetailPanel = defineComponent({
  props: {
    webhook: { type: Object as PropType<WebhookModel>, required: true },
    isMobile: { type: Boolean, default: false },
    onBack: { type: Function as PropType<() => void>, required: true },
    onEdit: { type: Function as PropType<() => void>, required: true },
    onDelete: { type: Function as PropType<() => void>, required: true },
    onTest: {
      type: Function as PropType<(event: string) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="flex flex-col h-full">
        {/* Header */}
        <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            {props.isMobile && (
              <button
                onClick={props.onBack}
                class="text-neutral-500 rounded-md flex size-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeft class="size-5" />
              </button>
            )}
            <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              Webhook 详情
            </h2>
          </div>
          <div class="flex gap-1 items-center">
            <DetailActionButton
              icon={PencilIcon}
              label="编辑"
              onClick={props.onEdit}
            />
            <NPopconfirm
              positiveText="取消"
              negativeText="删除"
              onNegativeClick={props.onDelete}
            >
              {{
                trigger: () => (
                  <DetailActionButton icon={TrashIcon} label="删除" danger />
                ),
                default: () => (
                  <span class="max-w-48">确定要删除此 Webhook 吗？</span>
                ),
              }}
            </NPopconfirm>
          </div>
        </div>

        {/* Content */}
        <NScrollbar class="flex-1 min-h-0">
          <div class="mx-auto p-6 max-w-3xl space-y-6">
            {/* Webhook Header */}
            <div class="flex gap-4 items-start">
              <div class="shrink-0 relative">
                <div class="rounded-2xl bg-neutral-100 flex size-14 items-center justify-center dark:bg-neutral-800">
                  <WebhookIcon class="text-neutral-500 size-7 dark:text-neutral-400" />
                </div>
                <div class="absolute -bottom-1 -right-1">
                  <div class="border-2 border-white rounded-full bg-white dark:border-black dark:bg-black">
                    <StatusIndicator enabled={props.webhook.enabled} />
                  </div>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex gap-2 items-center">
                  <span class="text-lg text-neutral-900 font-semibold truncate dark:text-neutral-100">
                    {props.webhook.payloadUrl || props.webhook.url}
                  </span>
                  <a
                    href={props.webhook.payloadUrl || props.webhook.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-neutral-400 shrink-0 hover:text-neutral-600 dark:hover:text-neutral-300"
                  >
                    <ExternalLinkIcon class="size-4" />
                  </a>
                </div>
                <div class="text-sm text-neutral-500 mt-1 flex gap-3 items-center dark:text-neutral-400">
                  <NTag
                    size="small"
                    type={props.webhook.enabled ? "success" : "default"}
                    bordered={false}
                    round
                  >
                    {props.webhook.enabled ? "已启用" : "已禁用"}
                  </NTag>
                  <span>{getScopeText(props.webhook.scope)}</span>
                </div>
              </div>
            </div>

            {/* Info Cards */}
            <div class="gap-4 grid grid-cols-2">
              <InfoCard
                icon={<Globe class="size-4" />}
                label="触发范围"
                value={getScopeText(props.webhook.scope)}
              />
              <InfoCard
                icon={<Shield class="size-4" />}
                label="Secret"
                value={props.webhook.secret ? "已配置" : "未配置"}
              />
            </div>

            {/* Events */}
            <div class="space-y-3">
              <h4 class="text-sm text-neutral-500 font-medium dark:text-neutral-400">
                触发事件 (
                {props.webhook.events.length}
                )
              </h4>
              <div class="flex flex-wrap gap-2">
                {props.webhook.events.map(event => (
                  <NTag
                    key={event}
                    size="small"
                    type={getEventColor(event)}
                    round
                    bordered={false}
                  >
                    {event}
                  </NTag>
                ))}
              </div>
            </div>

            {/* Test */}
            <div class="space-y-3">
              <h4 class="text-sm text-neutral-500 font-medium dark:text-neutral-400">
                发送测试
              </h4>
              <div class="flex flex-wrap gap-2">
                {props.webhook.events.map(event => (
                  <NButton
                    key={event}
                    size="small"
                    quaternary
                    onClick={() => props.onTest(event)}
                  >
                    {{
                      icon: () => <PlayIcon class="size-3.5" />,
                      default: () => event,
                    }}
                  </NButton>
                ))}
              </div>
            </div>
          </div>
        </NScrollbar>
      </div>
    );
  },
});

const InfoCard = defineComponent({
  props: {
    icon: { type: Object as PropType<VNode>, required: true },
    label: { type: String, required: true },
    value: { type: String, required: true },
  },
  setup(props) {
    return () => (
      <div class="p-4 border border-neutral-200 rounded-xl dark:border-neutral-800">
        <div class="text-neutral-400 mb-2 flex gap-2 items-center dark:text-neutral-500">
          {props.icon}
          <span class="text-xs">{props.label}</span>
        </div>
        <div class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
          {props.value}
        </div>
      </div>
    );
  },
});

const DetailActionButton = defineComponent({
  props: {
    icon: { type: Object as PropType<any>, required: true },
    label: { type: String, required: true },
    danger: { type: Boolean, default: false },
    onClick: { type: Function as PropType<() => void> },
  },
  setup(props) {
    return () => (
      <NTooltip>
        {{
          trigger: () => (
            <button
              onClick={props.onClick}
              class={[
                "flex size-8 items-center justify-center rounded-md transition-colors",
                props.danger
                  ? "text-neutral-500 hover:bg-red-50 hover:text-red-600 dark:text-neutral-400 dark:hover:bg-red-900/20 dark:hover:text-red-500"
                  : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
              ]}
            >
              <props.icon class="size-4" />
            </button>
          ),
          default: () => props.label,
        }}
      </NTooltip>
    );
  },
});

const WebhookDetailEmptyState = defineComponent({
  setup() {
    return () => (
      <div class="text-center bg-neutral-50 flex flex-col h-full items-center justify-center dark:bg-neutral-950">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <WebhookIcon class="text-neutral-400 size-8" />
        </div>
        <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">
          选择一个 Webhook
        </h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          从左侧列表选择查看详情
        </p>
      </div>
    );
  },
});

const WebhookListEmptyState = defineComponent({
  props: {
    onCreate: { type: Function as PropType<() => void>, required: true },
  },
  setup(props) {
    return () => (
      <div class="py-24 text-center flex flex-col items-center justify-center">
        <WebhookIcon class="text-neutral-300 mb-4 size-10 dark:text-neutral-700" />
        <p class="text-sm text-neutral-500">暂无 Webhook</p>
        <p class="text-xs text-neutral-400 mb-4 mt-1">
          创建 Webhook 以接收事件推送
        </p>
        <NButton size="small" type="primary" onClick={props.onCreate}>
          {{
            icon: () => <PlusIcon class="size-3.5" />,
            default: () => "创建 Webhook",
          }}
        </NButton>
      </div>
    );
  },
});

const WebhookEditDrawer = defineComponent({
  props: {
    show: { type: Boolean, required: true },
    formData: { type: Object as PropType<Partial<WebhookModel>> },
    onClose: { type: Function as PropType<() => void>, required: true },
    onSubmit: {
      type: Function as PropType<(data: Partial<WebhookModel>) => void>,
      required: true,
    },
  },
  setup(props) {
    const isEdit = computed(() => !!props.formData?.id);

    const localFormData = ref<Partial<WebhookModel>>({
      events: [],
      enabled: true,
      scope: EventScope.TO_SYSTEM,
    });

    const { data: eventsData } = useQuery({
      queryKey: queryKeys.webhooks.events(),
      queryFn: () => webhooksApi.getEvents(),
    });

    const availableEvents = computed(() => eventsData.value ?? []);

    watch(
      () => props.formData,
      (newData) => {
        if (newData) {
          localFormData.value = cloneDeep(newData);
        } else {
          localFormData.value = {
            events: [],
            enabled: true,
            scope: EventScope.TO_SYSTEM,
          };
        }
      },
      { immediate: true },
    );

    const checkedEventsSet = computed(() => new Set(localFormData.value.events));

    const handleSubmit = () => {
      props.onSubmit(localFormData.value);
    };

    return () => (
      <NDrawer
        show={props.show}
        onUpdateShow={show => !show && props.onClose()}
        width={500}
        placement="right"
      >
        <NDrawerContent
          title={isEdit.value ? "编辑 Webhook" : "创建 Webhook"}
          closable
        >
          <div class="space-y-6">
            <NForm labelPlacement="top">
              <NFormItem label="Payload URL" required>
                <NInput
                  value={localFormData.value.payloadUrl}
                  onUpdateValue={v => (localFormData.value.payloadUrl = v)}
                  placeholder="https://example.com/webhook"
                />
              </NFormItem>

              <NFormItem label="Secret">
                <NInput
                  value={localFormData.value.secret}
                  onUpdateValue={v => (localFormData.value.secret = v)}
                  type="password"
                  showPasswordOn="click"
                  placeholder={isEdit.value ? "留空保持不变" : "可选的签名密钥"}
                />
              </NFormItem>

              <NFormItem label="触发事件" required>
                <NLayoutContent
                  nativeScrollbar={false}
                  class="p-3 border border-neutral-200 rounded-lg dark:border-neutral-700 !bg-neutral-50 !h-[300px] dark:!bg-neutral-800/50"
                >
                  <div class="mb-3 pb-3 border-b border-neutral-200 dark:border-neutral-700">
                    <NCheckbox
                      checked={checkedEventsSet.value.has("all")}
                      onUpdateChecked={(checked) => {
                        if (checked) {
                          localFormData.value.events = ["all"];
                        } else {
                          localFormData.value.events = [];
                        }
                      }}
                    >
                      <span class="font-medium">全部事件</span>
                    </NCheckbox>
                  </div>
                  <NGrid cols={2} xGap={12} yGap={8}>
                    {availableEvents.value.map(event => (
                      <NGi key={event}>
                        <NCheckbox
                          checked={
                            checkedEventsSet.value.has(event)
                            || checkedEventsSet.value.has("all")
                          }
                          disabled={checkedEventsSet.value.has("all")}
                          onUpdateChecked={(checked) => {
                            const events = localFormData.value.events || [];
                            if (checked) {
                              localFormData.value.events = [...events, event];
                            } else {
                              localFormData.value.events = events.filter(
                                e => e !== event,
                              );
                            }
                          }}
                        >
                          <span class="text-sm">{event}</span>
                        </NCheckbox>
                      </NGi>
                    ))}
                  </NGrid>
                </NLayoutContent>
              </NFormItem>

              <NFormItem label="触发范围">
                <div class="flex flex-wrap gap-3">
                  {(
                    Object.keys(EventScope) as Array<keyof typeof EventScope>
                  ).map((key) => {
                    const scope = EventScope[key];
                    const value = localFormData.value.scope ?? 0;
                    const scopeLabels: Record<string, string> = {
                      TO_VISITOR: "访客操作",
                      TO_ADMIN: "管理员操作",
                      TO_SYSTEM: "系统事件",
                      ALL: "全部",
                    };
                    return (
                      <NCheckbox
                        key={key}
                        checked={
                          (value & scope) === scope || value === EventScope.ALL
                        }
                        onUpdateChecked={(checked) => {
                          if (checked) {
                            localFormData.value.scope
                              = (localFormData.value.scope ?? 0) | scope;
                          } else {
                            localFormData.value.scope
                              = (localFormData.value.scope ?? 0) & ~scope;
                          }
                        }}
                      >
                        {scopeLabels[key] || key}
                      </NCheckbox>
                    );
                  })}
                </div>
              </NFormItem>

              <NFormItem label="启用状态">
                <div class="flex gap-3 items-center">
                  <NSwitch
                    value={localFormData.value.enabled}
                    onUpdateValue={v => (localFormData.value.enabled = v)}
                  />
                </div>
              </NFormItem>
            </NForm>

            <div class="flex gap-3 justify-end">
              <NButton onClick={props.onClose}>取消</NButton>
              <NButton type="primary" onClick={handleSubmit}>
                {isEdit.value ? "保存" : "创建"}
              </NButton>
            </div>
          </div>
        </NDrawerContent>
      </NDrawer>
    );
  },
});

const WebhookDispatchPanel = defineComponent({
  props: {
    webhookId: { type: String, required: true },
  },
  setup(props) {
    const queryClient = useQueryClient();
    const page = ref(1);
    const size = 20;
    const expandedId = ref<string | null>(null);

    const { data: dispatchData, isLoading } = useQuery({
      queryKey: computed(() => [
        ...queryKeys.webhooks.dispatches(props.webhookId),
        page.value,
      ]),
      queryFn: () =>
        webhooksApi.getDispatches(props.webhookId, {
          page: page.value,
          size,
        }),
      placeholderData: keepPreviousData,
    });

    const dispatches = computed(
      () => (dispatchData.value as any)?.data ?? [],
    ) as ComputedRef<WebhookEventRecord[]>;
    const pagination = computed(() => (dispatchData.value as any)?.pagination);

    const redispatchMutation = useMutation({
      mutationFn: (eventId: string) =>
        webhooksApi.redispatch(props.webhookId, eventId),
      onSuccess: () => {
        toast.success("已重新推送");
        queryClient.invalidateQueries({
          queryKey: queryKeys.webhooks.dispatches(props.webhookId),
        });
      },
      onError: () => {
        toast.error("重新推送失败");
      },
    });

    watch(
      () => props.webhookId,
      () => {
        page.value = 1;
        expandedId.value = null;
      },
    );

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <span class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
            推送记录
          </span>
          {pagination.value && (
            <span class="text-xs text-neutral-400">
              共
              {" "}
              {pagination.value.total}
              {" "}
              条
            </span>
          )}
        </div>

        <NScrollbar class="flex-1 min-h-0">
          {isLoading.value
            ? (
                <div class="py-24 flex items-center justify-center">
                  <div class="border-2 border-neutral-300 border-t-neutral-900 rounded-full size-6 animate-spin dark:border-neutral-700 dark:border-t-white" />
                </div>
              )
            : dispatches.value.length === 0
              ? (
                  <div class="py-24 text-center flex flex-col items-center justify-center">
                    <span class="text-sm text-neutral-400">暂无推送记录</span>
                  </div>
                )
              : (
                  dispatches.value.map(dispatch => (
                    <div key={dispatch.id}>
                      <div
                        class="px-4 py-3 border-b border-neutral-100 flex gap-3 cursor-pointer transition-colors items-center dark:border-neutral-800/50 hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                        onClick={() =>
                          (expandedId.value
                            = expandedId.value === dispatch.id ? null : dispatch.id)}
                      >
                        <ChevronRight
                          class={[
                            "size-3.5 shrink-0 text-neutral-400 transition-transform",
                            expandedId.value === dispatch.id && "rotate-90",
                          ]}
                        />
                        <StatusIndicator enabled={dispatch.success} />
                        <div class="flex-1 min-w-0">
                          <NTag
                            size="small"
                            type={getEventColor(dispatch.event)}
                            bordered={false}
                            round
                          >
                            {dispatch.event}
                          </NTag>
                        </div>
                        <NTag
                          size="small"
                          type={dispatch.success ? "success" : "error"}
                          bordered={false}
                        >
                          {dispatch.status}
                        </NTag>
                        <span class="text-xs text-neutral-400 shrink-0">
                          {new Date(dispatch.timestamp).toLocaleString("zh-CN")}
                        </span>
                      </div>

                      {expandedId.value === dispatch.id && (
                        <div class="px-4 py-3 border-b border-neutral-100 bg-neutral-50 dark:border-neutral-800/50 dark:bg-neutral-900/50">
                          <div class="mb-3 flex justify-end">
                            <NButton
                              size="tiny"
                              quaternary
                              type="primary"
                              loading={redispatchMutation.isPending.value}
                              onClick={(e: Event) => {
                                e.stopPropagation();
                                redispatchMutation.mutate(dispatch.id);
                              }}
                            >
                              {{
                                icon: () => <RefreshIcon class="size-3" />,
                                default: () => "重新推送",
                              }}
                            </NButton>
                          </div>
                          <div class="space-y-2">
                            <DispatchDetailBlock
                              label="Payload"
                              content={dispatch.payload}
                            />
                            <DispatchDetailBlock
                              label="Response"
                              content={dispatch.response}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
        </NScrollbar>

        {pagination.value && pagination.value.totalPage > 1 && (
          <div class="py-2 border-t border-neutral-200 flex shrink-0 items-center justify-center dark:border-neutral-800">
            <NPagination
              page={page.value}
              pageCount={pagination.value.totalPage}
              onUpdatePage={(p: number) => (page.value = p)}
              size="small"
            />
          </div>
        )}
      </div>
    );
  },
});

const DispatchDetailBlock = defineComponent({
  props: {
    label: { type: String, required: true },
    content: {
      type: [Object, String, Array, Number, Boolean] as PropType<any>,
      default: null,
    },
  },
  setup(props) {
    const formatted = computed(() => {
      if (!props.content)
        return "";
      if (typeof props.content === "string") {
        try {
          return JSON.stringify(JSON.parse(props.content), null, 2);
        } catch {
          return props.content;
        }
      }
      return JSON.stringify(props.content, null, 2);
    });

    return () => (
      <div>
        <div class="text-xs text-neutral-500 font-medium mb-1">
          {props.label}
        </div>
        <pre class="text-xs text-neutral-700 p-2 rounded-lg bg-neutral-100 max-h-48 overflow-auto dark:text-neutral-300 dark:bg-neutral-800">
          {formatted.value || "-"}
        </pre>
      </div>
    );
  },
});
