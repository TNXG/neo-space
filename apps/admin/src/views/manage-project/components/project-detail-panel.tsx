import type { PropType } from "vue";
import type { IGithubRepo } from "~/external/api/github-repo";
import type { ProjectModel } from "~/models/project";
import { useMutation } from "@tanstack/vue-query";
import {
  ArrowLeft as ArrowLeftIcon,
  Code2,
  ExternalLink,
  Folder,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-vue-next";
import {
  NAvatar,
  NButton,
  NDynamicTags,
  NInput,
  NPopconfirm,
  NScrollbar,
  NTooltip,
} from "naive-ui";
import { defineComponent, reactive, ref, toRaw, watch } from "vue";

import { toast } from "vue-sonner";

import { projectsApi } from "~/api/projects";
import { Editor } from "~/components/editor/universal";
import { MarkdownRender } from "~/components/markdown/markdown-render";
import { FetchGithubRepoButton } from "~/components/special-button/fetch-github-repo";
import { RelativeTime } from "~/components/time/relative-time";
import { textToBigCharOrWord } from "~/utils/word";

interface ProjectFormData {
  name: string;
  previewUrl: string;
  docUrl: string;
  projectUrl: string;
  images: string[];
  description: string;
  avatar: string;
  text: string;
}

function pickImagesFromMarkdown(text: string): string[] {
  const reg = /(?<=!\[.*\]\()(.+)(?=\))/g;
  const images: string[] = [];
  for (const r of text.matchAll(reg)) {
    images.push(r[0]);
  }
  return images;
}

function formDataToPayload(
  formData: ProjectFormData,
  opts?: { requireName?: boolean },
): Partial<ProjectModel> {
  if (
    opts?.requireName
    && (!formData.name || formData.name.trim().length === 0)
  ) {
    throw "项目名称不能为空";
  }
  if (!formData.text || formData.text.trim().length === 0) {
    throw "内容为空";
  }
  const raw = toRaw(formData);
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key]
      = typeof value === "undefined"
        ? null
        : typeof value === "string" && value.length === 0
          ? ""
          : value;
  }
  result.text = formData.text.trim();
  return result as Partial<ProjectModel>;
}

function applyGithubRepo(
  formData: ProjectFormData,
  data: IGithubRepo,
  readme?: string | null,
): void {
  formData.description = data.description || "";
  formData.projectUrl = data.html_url || "";
  formData.previewUrl = data.homepage || "";
  formData.images = pickImagesFromMarkdown(readme || "");
  formData.name = data.name || "";
  formData.text = readme || "";
}

const FormField = defineComponent({
  props: {
    label: { type: String, required: true },
    required: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    return () => (
      <div class="mb-4">
        <label class="text-sm text-neutral-700 font-medium mb-1.5 block dark:text-neutral-300">
          {props.label}
          {props.required && <span class="text-red-500 ml-0.5">*</span>}
        </label>
        {slots.default?.()}
      </div>
    );
  },
});

export const ProjectDetailPanel = defineComponent({
  name: "ProjectDetailPanel",
  props: {
    projectId: {
      type: String as PropType<string | null>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onDelete: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    onSaved: {
      type: Function as PropType<() => void>,
    },
  },
  setup(props) {
    const project = ref<ProjectModel | null>(null);
    const loading = ref(false);
    const isEditing = ref(false);

    const formData = reactive<ProjectFormData>({
      name: "",
      previewUrl: "",
      docUrl: "",
      projectUrl: "",
      images: [],
      description: "",
      avatar: "",
      text: "",
    });

    const resetForm = () => {
      if (project.value) {
        formData.name = project.value.name || "";
        formData.previewUrl = project.value.previewUrl || "";
        formData.docUrl = project.value.docUrl || "";
        formData.projectUrl = project.value.projectUrl || "";
        formData.images = project.value.images || [];
        formData.description = project.value.description || "";
        formData.avatar = project.value.avatar || "";
        formData.text = project.value.text || "";
      }
    };

    const fetchProject = async (id: string) => {
      loading.value = true;
      try {
        const data = await projectsApi.getById(id);
        project.value = data;
        resetForm();
      } finally {
        loading.value = false;
      }
    };

    watch(
      () => props.projectId,
      (id) => {
        if (id) {
          isEditing.value = false;
          fetchProject(id);
        } else {
          project.value = null;
        }
      },
      { immediate: true },
    );

    const updateMutation = useMutation({
      mutationFn: ({ id, data }: { id: string; data: any }) =>
        projectsApi.update(id, data),
      onSuccess: (data) => {
        toast.success("保存成功");
        project.value = data;
        isEditing.value = false;
        props.onSaved?.();
      },
    });

    const handleSave = () => {
      if (!props.projectId)
        return;
      try {
        const payload = formDataToPayload(formData);
        updateMutation.mutate({ id: props.projectId, data: payload });
      } catch (error) {
        toast.error(error as any);
      }
    };

    const handleCancelEdit = () => {
      isEditing.value = false;
      resetForm();
    };

    const ActionButton = (p: {
      icon: any;
      onClick: () => void;
      label: string;
      class?: string;
    }) => (
      <NTooltip>
        {{
          trigger: () => (
            <button
              onClick={p.onClick}
              class={`text-neutral-500 rounded-md flex h-8 w-8 transition-colors items-center justify-center dark:text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800 ${p.class || ""}`}
            >
              <p.icon class="h-4 w-4" />
            </button>
          ),
          default: () => p.label,
        }}
      </NTooltip>
    );

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex flex-shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            {props.isMobile && props.onBack && (
              <button
                onClick={props.onBack}
                class="text-neutral-500 rounded-md flex h-8 w-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon class="h-5 w-5" />
              </button>
            )}
            <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              {isEditing.value ? "编辑项目" : "项目详情"}
            </h2>
          </div>

          {project.value && (
            <div class="flex gap-1 items-center">
              {isEditing.value
                ? (
                    <>
                      <FetchGithubRepoButton
                        onData={(data, readme) =>
                          applyGithubRepo(formData, data, readme)}
                        defaultValue={formData.projectUrl}
                      />
                      <ActionButton
                        icon={X}
                        label="取消"
                        onClick={handleCancelEdit}
                      />
                      <NButton
                        size="small"
                        type="primary"
                        loading={updateMutation.isPending.value}
                        onClick={handleSave}
                      >
                        {{
                          icon: () => <Save class="size-4" />,
                          default: () => "保存",
                        }}
                      </NButton>
                    </>
                  )
                : (
                    <>
                      <ActionButton
                        icon={Pencil}
                        label="编辑"
                        onClick={() => (isEditing.value = true)}
                      />
                      <NPopconfirm
                        positiveText="确认删除"
                        negativeText="取消"
                        onPositiveClick={() => props.onDelete(project.value!.id!)}
                      >
                        {{
                          trigger: () => (
                            <div class="inline-block">
                              <ActionButton
                                icon={Trash2}
                                label="删除"
                                onClick={() => {}}
                                class="hover:text-red-600 hover:bg-red-50 dark:hover:text-red-500 dark:hover:bg-red-900/20"
                              />
                            </div>
                          ),
                          default: () => `确定要删除「${project.value?.name}」吗？`,
                        }}
                      </NPopconfirm>
                    </>
                  )}
            </div>
          )}
        </div>

        <NScrollbar class="flex-1 min-h-0">
          {loading.value
            ? (
                <ProjectDetailSkeleton />
              )
            : project.value
              ? (
                  isEditing.value
                    ? (
                        <ProjectEditForm formData={formData} />
                      )
                    : (
                        <ProjectDetailView project={project.value} />
                      )
                )
              : null}
        </NScrollbar>
      </div>
    );
  },
});

const ProjectDetailView = defineComponent({
  props: {
    project: {
      type: Object as PropType<ProjectModel>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="mx-auto p-6 max-w-3xl space-y-6">
        <div class="flex gap-4 items-start">
          <div class="shrink-0">
            {props.project.avatar
              ? (
                  <NAvatar
                    round
                    size={56}
                    src={props.project.avatar}
                    class="ring-2 ring-neutral-200 dark:ring-neutral-700"
                  />
                )
              : (
                  <div class="text-xl text-neutral-600 font-semibold rounded-full flex size-14 ring-2 ring-neutral-200 items-center justify-center from-neutral-200 to-neutral-300 bg-gradient-to-br dark:text-neutral-300 dark:ring-neutral-700 dark:from-neutral-700 dark:to-neutral-600">
                    {textToBigCharOrWord(props.project.name)}
                  </div>
                )}
          </div>

          <div class="flex-1 min-w-0">
            <h3 class="text-lg text-neutral-900 font-semibold dark:text-neutral-100">
              {props.project.name}
            </h3>
            {props.project.description && (
              <p class="text-sm text-neutral-600 mt-1 dark:text-neutral-400">
                {props.project.description}
              </p>
            )}
            <div class="text-xs text-neutral-400 mt-2 flex flex-wrap gap-3 items-center">
              <span class="flex gap-1 items-center">
                创建于
                {" "}
                <RelativeTime time={props.project.createdAt} />
              </span>
            </div>
          </div>
        </div>

        {(() => {
          const links = [
            { url: props.project.projectUrl, icon: Code2, label: "源码" },
            {
              url: props.project.previewUrl,
              icon: ExternalLink,
              label: "预览",
            },
            { url: props.project.docUrl, icon: ExternalLink, label: "文档" },
          ].filter(l => l.url);
          if (links.length === 0)
            return null;
          return (
            <>
              <div class="bg-neutral-100 h-px dark:bg-neutral-800" />
              <div class="flex flex-wrap gap-2">
                {links.map(({ url, icon: Icon, label }) => (
                  <a
                    key={label}
                    href={url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-sm text-neutral-700 px-3 py-1.5 rounded-md bg-neutral-100 inline-flex gap-1.5 transition-colors items-center dark:text-neutral-300 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <Icon class="size-4" />
                    {label}
                  </a>
                ))}
              </div>
            </>
          );
        })()}

        {props.project.images && props.project.images.length > 0 && (
          <>
            <div class="bg-neutral-100 h-px dark:bg-neutral-800" />
            <div>
              <h4 class="text-sm text-neutral-700 font-medium mb-3 dark:text-neutral-300">
                预览图片
              </h4>
              <div class="gap-2 grid grid-cols-2">
                {props.project.images.map((img, idx) => (
                  <a
                    key={idx}
                    href={img}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="rounded-lg overflow-hidden"
                  >
                    <img
                      src={img}
                      alt={`预览图 ${idx + 1}`}
                      class="h-32 w-full transition-transform object-cover hover:scale-105"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </div>
          </>
        )}

        {props.project.text && (
          <>
            <div class="bg-neutral-100 h-px dark:bg-neutral-800" />
            <div>
              <h4 class="text-sm text-neutral-700 font-medium mb-3 dark:text-neutral-300">
                项目介绍
              </h4>
              <MarkdownRender text={props.project.text} />
            </div>
          </>
        )}
      </div>
    );
  },
});

const ProjectEditForm = defineComponent({
  props: {
    formData: {
      type: Object as PropType<ProjectFormData>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="mx-auto p-6 max-w-3xl space-y-4">
        <FormField label="项目名称" required>
          <NInput
            value={props.formData.name}
            onUpdateValue={v => (props.formData.name = v)}
            placeholder="输入项目名称"
          />
        </FormField>

        <FormField label="项目描述" required>
          <NInput
            value={props.formData.description}
            onUpdateValue={v => (props.formData.description = v)}
            placeholder="简短描述项目"
          />
        </FormField>

        <FormField label="项目图标">
          <NInput
            value={props.formData.avatar}
            onUpdateValue={v => (props.formData.avatar = v)}
            placeholder="图标 URL"
          />
        </FormField>

        <FormField label="项目地址">
          <NInput
            value={props.formData.projectUrl}
            onUpdateValue={v => (props.formData.projectUrl = v)}
            placeholder="GitHub 或其他仓库地址"
          />
        </FormField>

        <FormField label="预览地址">
          <NInput
            value={props.formData.previewUrl}
            onUpdateValue={v => (props.formData.previewUrl = v)}
            placeholder="在线预览地址"
          />
        </FormField>

        <FormField label="文档地址">
          <NInput
            value={props.formData.docUrl}
            onUpdateValue={v => (props.formData.docUrl = v)}
            placeholder="文档地址"
          />
        </FormField>

        <FormField label="预览图片">
          <NDynamicTags
            round
            value={props.formData.images}
            onUpdateValue={(v: string[]) => (props.formData.images = v)}
          />
        </FormField>

        <FormField label="正文" required>
          <Editor
            loading={false}
            unSaveConfirm={false}
            class="h-[calc(100vh-42rem)] min-h-60 w-full [&_.cm-content]:!mx-0 [&_.cm-content]:!max-w-full"
            onChange={v => (props.formData.text = v)}
            text={props.formData.text}
          />
        </FormField>
      </div>
    );
  },
});

export const ProjectDetailEmptyState = defineComponent({
  name: "ProjectDetailEmptyState",
  setup() {
    return () => (
      <div class="text-center bg-neutral-50 flex flex-col h-full items-center justify-center dark:bg-neutral-950">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <Folder class="text-neutral-400 size-8" />
        </div>
        <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">
          选择一个项目
        </h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">
          从左侧列表选择项目查看详情
        </p>
      </div>
    );
  },
});

const ProjectDetailSkeleton = defineComponent({
  setup() {
    return () => (
      <div class="flex h-full items-center inset-0 justify-center absolute">
        <div class="border-2 border-neutral-300 border-t-neutral-900 rounded-full h-6 w-6 animate-spin dark:border-neutral-700 dark:border-t-white" />
      </div>
    );
  },
});

export const ProjectCreatePanel = defineComponent({
  name: "ProjectCreatePanel",
  props: {
    isMobile: {
      type: Boolean,
      default: false,
    },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onCancel: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onCreated: {
      type: Function as PropType<(project: ProjectModel) => void>,
      required: true,
    },
  },
  setup(props) {
    const formData = reactive<ProjectFormData>({
      name: "",
      previewUrl: "",
      docUrl: "",
      projectUrl: "",
      images: [],
      description: "",
      avatar: "",
      text: "",
    });

    const createMutation = useMutation({
      mutationFn: (data: any) => projectsApi.create(data),
      onSuccess: (data) => {
        toast.success("创建成功");
        props.onCreated(data);
      },
    });

    const handleSave = () => {
      try {
        const payload = formDataToPayload(formData, { requireName: true });
        createMutation.mutate(payload);
      } catch (error) {
        toast.error(error as any);
      }
    };

    const handleBack = () => {
      props.onBack?.();
      props.onCancel();
    };

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex flex-shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            {props.isMobile && (
              <button
                onClick={handleBack}
                class="text-neutral-500 rounded-md flex h-8 w-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon class="h-5 w-5" />
              </button>
            )}
            <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              新建项目
            </h2>
          </div>

          <div class="flex gap-1 items-center">
            <FetchGithubRepoButton
              onData={(data, readme) => applyGithubRepo(formData, data, readme)}
              defaultValue={formData.projectUrl}
            />
            <NButton size="small" onClick={props.onCancel}>
              取消
            </NButton>
            <NButton
              size="small"
              type="primary"
              loading={createMutation.isPending.value}
              onClick={handleSave}
            >
              {{
                icon: () => <Save class="size-4" />,
                default: () => "创建",
              }}
            </NButton>
          </div>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          <ProjectEditForm formData={formData} />
        </NScrollbar>
      </div>
    );
  },
});
