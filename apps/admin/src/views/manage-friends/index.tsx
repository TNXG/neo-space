import type {
  LinkHealthStatus,
  LinkModel,
  LinkStateCount,
} from "~/models/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Check as CheckIcon, Mail as MailIcon, Plus } from "lucide-vue-next";
import {
  NButton,
  NCard,
  NDynamicTags,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
} from "naive-ui";
import { computed, defineComponent, Fragment, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";

import { toast } from "vue-sonner";

import { linksApi } from "~/api/links";
import { HeaderActionButton } from "~/components/button/header-action-button";
import { Table } from "~/components/table";
import { RelativeTime } from "~/components/time/relative-time";
import { queryKeys } from "~/hooks/queries/keys";
import { useDataTable } from "~/hooks/use-data-table";
import { useLayout } from "~/layouts/content";
import { LinkState, LinkStateNameMap, LinkType } from "~/models/link";
import { RouteName } from "~/router/name";

import { Avatar } from "./components/avatar";
import {
  LinkNotificationModal,
  type LinkNotificationContent,
} from "./components/notification-modal";
import { UrlComponent } from "./url-components";

type LinkFormData = Pick<
  LinkModel,
  | "avatar"
  | "name"
  | "type"
  | "url"
  | "description"
  | "state"
  | "email"
  | "rssurl"
  | "techstack"
> & {
  _id: string | null;
  health?: LinkHealthStatus | null;
};

export default defineComponent({
  setup() {
    const route = useRoute();
    const router = useRouter();
    const queryClient = useQueryClient();

    const tabValue = ref<LinkState>(
      Number(route.query.state ?? LinkState.Pass) as LinkState,
    );

    const {
      data,
      pager,
      isLoading: loading,
      refresh,
    } = useDataTable<LinkModel>({
      queryKey: (params) =>
        queryKeys.links.list({ ...params, state: params.filters?.state }),
      queryFn: (params) =>
        linksApi.getList({
          page: params.page,
          size: params.size,
          state: params.filters?.state,
        }),
      pageSize: 50,
      filters: () => ({ state: tabValue.value }),
    });

    const resetEditData = (): LinkFormData => ({
      avatar: "",
      name: "",
      type: LinkType.Friend,
      url: "",
      _id: null,
      description: "",
      state: LinkState.Pass,
      email: null,
      rssurl: null,
      techstack: [],
      health: null,
    });
    const normalizeEditData = (link: LinkModel): LinkFormData => ({
      _id: link._id,
      avatar: link.avatar,
      name: link.name,
      type: link.type,
      url: link.url,
      description: link.description ?? "",
      state: link.state,
      email: link.email ?? null,
      rssurl: link.rssurl ?? null,
      techstack: link.techstack ?? [],
      health: link.health ?? null,
    });
    const optionalText = (value?: string | null) => {
      const normalized = value?.trim();
      return normalized ? normalized : null;
    };
    const editDialogShow = ref(false);
    const editDialogData = ref(resetEditData());
    const notificationDialogShow = ref(false);
    const notificationLink = ref<LinkModel | null>(null);

    const { data: stateCountData, refetch: refetchStateCount } = useQuery({
      queryKey: queryKeys.links.stateCount(),
      queryFn: linksApi.getStateCount,
    });
    const stateCount = computed(
      () => stateCountData.value || ({} as LinkStateCount),
    );

    const saveMutation = useMutation({
      mutationFn: async (editData: typeof editDialogData.value) => {
        const id = editData._id;
        const payload = {
          avatar: editData.avatar,
          name: editData.name,
          type: editData.type,
          url: editData.url,
          description: editData.description,
          state: editData.state,
          email: optionalText(editData.email),
          rssurl: optionalText(editData.rssurl),
          techstack: editData.techstack?.length ? editData.techstack : null,
        };
        if (id) {
          return await linksApi.update(id, payload);
        } else {
          return await linksApi.create(payload);
        }
      },
      onSuccess: () => {
        toast.success("操作成功");
        queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
        refetchStateCount();
        editDialogShow.value = false;
        editDialogData.value = resetEditData();
      },
    });

    const deleteMutation = useMutation({
      mutationFn: linksApi.delete,
      onSuccess: () => {
        toast.success("删除成功");
        queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
        refetchStateCount();
      },
    });

    const auditPassMutation = useMutation({
      mutationFn: linksApi.auditPass,
      onSuccess: (_, id) => {
        const item = data.value.find((i) => i._id === id);
        toast.success(`通过了来自${item?.name || ""}的友链邀请`);
        queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
        refetchStateCount();
      },
    });

    const rejectMutation = useMutation({
      mutationFn: (id: string) => linksApi.updateState(id, LinkState.Rejected),
      onSuccess: (_, id) => {
        const item = data.value.find((i) => i._id === id);
        toast.success(`已将「${item?.name || ""}」标记为不通过`);
        queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
        refetchStateCount();
      },
    });

    const notificationMutation = useMutation({
      mutationFn: ({
        linkId,
        notification,
      }: {
        linkId: string;
        notification: LinkNotificationContent;
      }) => linksApi.sendNotification(linkId, notification),
      onSuccess: () => {
        toast.success("邮件已发送");
        notificationDialogShow.value = false;
        notificationLink.value = null;
      },
    });

    /**
     * 打开独立邮件草稿，不修改友链状态，也不从管理操作推断是否需要通知。
     */
    const openNotificationDialog = (link: LinkModel) => {
      notificationLink.value = link;
      notificationDialogShow.value = true;
    };

    const onSubmit = () => {
      saveMutation.mutate(editDialogData.value);
    };

    const handleCheck = async () => {
      const l = toast.loading("检查中", { duration: 20e4 });

      try {
        await linksApi.checkHealth({ timeout: 20e4 });
        queryClient.invalidateQueries({ queryKey: queryKeys.links.all });
        toast.success("检查完成");
      } catch (error) {
        console.error(error);
      } finally {
        requestAnimationFrame(() => {
          toast.dismiss(l);
        });
      }
    };

    const { setActions } = useLayout();
    watchEffect(() => {
      setActions(
        <Fragment>
          <HeaderActionButton
            icon={<Plus />}
            variant="primary"
            onClick={() => {
              editDialogData.value = resetEditData();
              editDialogShow.value = true;
            }}
          />

          <HeaderActionButton
            icon={<CheckIcon />}
            variant="info"
            onClick={handleCheck}
            name="检查友链可用性"
          />
        </Fragment>,
      );
    });

    return () => (
      <>
        <section class="mb-4">
          <NTabs
            class="min-h-[30px]"
            size="medium"
            value={tabValue.value}
            onUpdateValue={(e) => {
              tabValue.value = e;

              router.replace({ name: RouteName.Friend, query: { state: e } });
            }}
          >
            {[
              {
                state: LinkState.Pass,
                label: "朋友们",
                countKey: "pass" as const,
                highlight: false,
              },
              {
                state: LinkState.Audit,
                label: "待审核",
                countKey: "audit" as const,
                highlight: true,
              },
              {
                state: LinkState.Outdate,
                label: "过时的",
                countKey: "outdate" as const,
                highlight: false,
              },
              {
                state: LinkState.Banned,
                label: "封禁的",
                countKey: "banned" as const,
                highlight: false,
              },
              {
                state: LinkState.Rejected,
                label: "不通过",
                countKey: "rejected" as const,
                highlight: false,
              },
            ].map(({ state, label, countKey, highlight }) => (
              <NTabPane
                key={state}
                name={state}
                tab={() => (
                  <div class="flex gap-2 items-center">
                    <span>{label}</span>
                    <span
                      class={[
                        "rounded-full px-2 py-0.5 text-xs",
                        highlight
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
                      ]}
                    >
                      {stateCount.value[countKey] || 0}
                    </span>
                  </div>
                )}
              />
            ))}
          </NTabs>
        </section>

        <section>
          <Table
            loading={loading.value}
            data={data}
            nTableProps={{
              maxHeight: "calc(100vh - 12rem)",
            }}
            columns={[
              {
                title: "头像",
                key: "avatar",
                width: 80,
                render(row) {
                  return <Avatar name={row.name} avatar={row.avatar} />;
                },
              },
              {
                title: "名称",
                key: "name",
                render(row) {
                  return (
                    <a
                      target="_blank"
                      href={row.url}
                      rel="noreferrer"
                      class="hover:text-primary-600 dark:hover:text-primary-400 text-neutral-700 dark:text-neutral-300"
                    >
                      {row.name}
                    </a>
                  );
                },
              },
              {
                title: "描述",
                key: "description",
                width: 250,
                ellipsis: { lineClamp: 2, tooltip: true },
              },
              {
                title: "网址",
                key: "url",
                render(row) {
                  const urlHealth = row.health;
                  const healthErrorMessage =
                    urlHealth && !urlHealth.is_alive
                      ? (urlHealth.error_message ?? "HTTP 状态异常")
                      : undefined;
                  return (
                    <UrlComponent
                      url={row.url}
                      errorMessage={healthErrorMessage}
                      status={
                        urlHealth
                          ? (urlHealth.status_code ??
                            (urlHealth.is_alive ? 200 : "ERR"))
                          : undefined
                      }
                    />
                  );
                },
              },
              {
                title: "类型",
                key: "type",
                width: 80,
                render(row) {
                  return ["朋友", "收藏"][row.type | 0];
                },
              },
              {
                title: "对方邮箱",
                key: "email",
                render(row) {
                  if (!row.email)
                    return <span class="text-neutral-400">-</span>;

                  return (
                    <a
                      href={`mailto:${row.email}`}
                      class="hover:text-primary-600 dark:hover:text-primary-400 text-neutral-600 dark:text-neutral-400"
                    >
                      {row.email}
                    </a>
                  );
                },
              },
              {
                title: "结识时间",
                key: "created",
                width: 80,
                render(row) {
                  return <RelativeTime time={row.created} />;
                },
              },
              {
                width: 150,
                title: "操作",
                fixed: "right",
                key: "action",
                render(row) {
                  return (
                    <NSpace wrap={false}>
                      {row.state == LinkState.Audit && (
                        <>
                          <NButton
                            quaternary
                            size="tiny"
                            type="primary"
                            onClick={() => auditPassMutation.mutate(row._id)}
                          >
                            通过
                          </NButton>
                          <NButton
                            quaternary
                            size="tiny"
                            type="error"
                            onClick={() => rejectMutation.mutate(row._id)}
                          >
                            不通过
                          </NButton>
                        </>
                      )}
                      <NButton
                        quaternary
                        size="tiny"
                        type="info"
                        onClick={() => {
                          editDialogShow.value = true;
                          editDialogData.value = normalizeEditData(row);
                        }}
                      >
                        编辑
                      </NButton>
                      {row.email && (
                        <NButton
                          class="cursor-pointer"
                          quaternary
                          size="tiny"
                          type="info"
                          onClick={() => openNotificationDialog(row)}
                        >
                          {{
                            icon: () => <MailIcon />,
                            default: () => "发邮件",
                          }}
                        </NButton>
                      )}
                      <NPopconfirm
                        positiveText="取消"
                        negativeText="删除"
                        onNegativeClick={() => deleteMutation.mutate(row._id)}
                      >
                        {{
                          trigger: () => (
                            <NButton quaternary type="error" size="tiny">
                              移除
                            </NButton>
                          ),

                          default: () => (
                            <span class="max-w-48">
                              确定要删除友链 {row.name} ?
                            </span>
                          ),
                        }}
                      </NPopconfirm>
                    </NSpace>
                  );
                },
              },
            ]}
            onFetchData={refresh}
            pager={pager as any}
          />
        </section>

        <NModal
          transformOrigin="center"
          show={editDialogShow.value}
          onUpdateShow={(e) => void (editDialogShow.value = e)}
        >
          <NCard
            style="width: 500px;max-width: 90vw"
            headerStyle={{ textAlign: "center" }}
            title={
              editDialogData.value._id
                ? `编辑: ${editDialogData.value.name}`
                : "新增"
            }
          >
            <NForm>
              {editDialogData.value.health && (
                <NFormItem label="检测状态">
                  <NSpace align="center" size={8}>
                    <NTag
                      type={
                        editDialogData.value.health.is_alive
                          ? "success"
                          : "error"
                      }
                      size="small"
                    >
                      {editDialogData.value.health.is_alive
                        ? "可访问"
                        : "不可访问"}
                    </NTag>
                    {editDialogData.value.health.status_code && (
                      <NTag size="small">
                        HTTP {editDialogData.value.health.status_code}
                      </NTag>
                    )}
                    {typeof editDialogData.value.health.latency_ms ===
                      "number" && (
                      <NTag size="small">
                        {editDialogData.value.health.latency_ms}
                        ms
                      </NTag>
                    )}
                    {editDialogData.value.health.hosting_provider && (
                      <NTag size="small">
                        {editDialogData.value.health.hosting_provider}
                      </NTag>
                    )}
                  </NSpace>
                </NFormItem>
              )}

              <NFormItem label="名字" required>
                <NInput
                  autofocus
                  value={editDialogData.value.name}
                  onInput={(e) => void (editDialogData.value.name = e)}
                />
              </NFormItem>

              <NFormItem label="头像">
                <NInput
                  autofocus
                  value={editDialogData.value.avatar}
                  onInput={(e) => void (editDialogData.value.avatar = e)}
                />
              </NFormItem>

              <NFormItem label="网址" required>
                <NInput
                  autofocus
                  value={editDialogData.value.url}
                  onInput={(e) => void (editDialogData.value.url = e)}
                />
              </NFormItem>

              <NFormItem label="描述">
                <NInput
                  type="textarea"
                  value={editDialogData.value.description}
                  onInput={(e) => void (editDialogData.value.description = e)}
                />
              </NFormItem>

              <NFormItem label="邮箱">
                <NInput
                  value={editDialogData.value.email ?? ""}
                  onInput={(e) => void (editDialogData.value.email = e)}
                />
              </NFormItem>

              <NFormItem label="RSS">
                <NInput
                  value={editDialogData.value.rssurl ?? ""}
                  onInput={(e) => void (editDialogData.value.rssurl = e)}
                />
              </NFormItem>

              <NFormItem label="技术栈">
                <NDynamicTags
                  value={editDialogData.value.techstack ?? []}
                  onUpdateValue={(e) =>
                    void (editDialogData.value.techstack = e)
                  }
                />
              </NFormItem>

              <NFormItem label="类型">
                <NSelect
                  placeholder="选择类型"
                  options={[
                    { label: "朋友", value: LinkType.Friend },
                    { label: "收藏", value: LinkType.Collection },
                  ]}
                  value={editDialogData.value.type}
                  onUpdateValue={(e) =>
                    void (editDialogData.value.type = e | 0)
                  }
                />
              </NFormItem>
              {editDialogData.value._id && (
                <NFormItem label="状态">
                  <NSelect
                    placeholder="选择状态"
                    options={Object.entries(LinkStateNameMap).map(([k, v]) => ({
                      label: v,
                      value: LinkState[k],
                    }))}
                    value={editDialogData.value.state}
                    onUpdateValue={(e) =>
                      void (editDialogData.value.state = e | 0)
                    }
                  />
                </NFormItem>
              )}
            </NForm>

            <div class="text-right">
              <NSpace size={12} align="center" inline>
                <NButton type="primary" onClick={onSubmit} round>
                  确定
                </NButton>
                <NButton
                  onClick={() => {
                    editDialogShow.value = false;
                    editDialogData.value = resetEditData();
                  }}
                  round
                >
                  取消
                </NButton>
              </NSpace>
            </div>
          </NCard>
        </NModal>

        <LinkNotificationModal
          show={notificationDialogShow.value}
          link={notificationLink.value}
          loading={notificationMutation.isPending.value}
          onUpdateShow={(show) => {
            notificationDialogShow.value = show;
            if (!show) {
              notificationLink.value = null;
            }
          }}
          onSend={(notification) => {
            if (!notificationLink.value) {
              return;
            }
            notificationMutation.mutate({
              linkId: notificationLink.value._id,
              notification,
            });
          }}
        />
      </>
    );
  },
});
