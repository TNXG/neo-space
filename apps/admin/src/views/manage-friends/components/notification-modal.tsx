import type { LinkModel } from "~/models/link";
import type { PropType } from "vue";
import {
  NButton,
  NCard,
  NCheckbox,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSpace,
} from "naive-ui";
import { defineComponent, ref, watch } from "vue";

export interface LinkNotificationContent {
  subject: string;
  content: string;
}

export const LinkNotificationModal = defineComponent({
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    link: {
      type: Object as PropType<LinkModel | null>,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    onUpdateShow: {
      type: Function as PropType<(show: boolean) => void>,
      required: true,
    },
    onSend: {
      type: Function as PropType<(content: LinkNotificationContent) => void>,
      required: true,
    },
  },
  setup(props) {
    const subject = ref("");
    const content = ref("");
    const confirmed = ref(false);

    /**
     * 每次打开弹窗都创建独立草稿，避免上一次邮件内容被误发给其他联系人。
     */
    const resetDraft = () => {
      subject.value = props.link ? `关于友链「${props.link.name}」的沟通` : "";
      content.value = "";
      confirmed.value = false;
    };

    watch(
      () => [props.show, props.link?._id] as const,
      ([show]) => {
        if (show) {
          resetDraft();
        }
      },
    );

    /**
     * 只有博主完成内容检查并显式确认后，才向上层提交发送动作。
     */
    const handleSend = () => {
      if (!confirmed.value || !subject.value.trim() || !content.value.trim()) {
        return;
      }
      props.onSend({
        subject: subject.value.trim(),
        content: content.value.trim(),
      });
    };

    return () => (
      <NModal
        show={props.show}
        onUpdateShow={props.onUpdateShow}
        transformOrigin="center"
      >
        <NCard
          class="w-[min(36rem,90vw)]"
          title="发送友链邮件"
          closable
          onClose={() => props.onUpdateShow(false)}
        >
          <NForm>
            <NFormItem label="收件人">
              <NInput value={props.link?.email ?? ""} disabled />
            </NFormItem>
            <NFormItem label="主题" required>
              <NInput
                value={subject.value}
                maxlength={200}
                showCount
                onUpdateValue={(value) => (subject.value = value)}
              />
            </NFormItem>
            <NFormItem label="正文" required>
              <NInput
                type="textarea"
                value={content.value}
                maxlength={10000}
                showCount
                autosize={{ minRows: 8, maxRows: 16 }}
                placeholder="请根据实际情况撰写通知内容。状态变化不会自动填入或发送。"
                onUpdateValue={(value) => (content.value = value)}
              />
            </NFormItem>
            <NCheckbox
              checked={confirmed.value}
              onUpdateChecked={(value) => (confirmed.value = value)}
            >
              我已核对收件人、主题和正文，确认立即发送
            </NCheckbox>
          </NForm>

          <NSpace class="mt-6" justify="end">
            <NButton
              class="cursor-pointer"
              onClick={() => props.onUpdateShow(false)}
            >
              取消
            </NButton>
            <NButton
              class="cursor-pointer"
              type="primary"
              loading={props.loading}
              disabled={
                !confirmed.value ||
                !subject.value.trim() ||
                !content.value.trim()
              }
              onClick={handleSend}
            >
              确认发送
            </NButton>
          </NSpace>
        </NCard>
      </NModal>
    );
  },
});
