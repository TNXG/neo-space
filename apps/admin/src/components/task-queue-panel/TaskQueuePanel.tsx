import type { VNode } from "vue";
import { ChevronDown, ChevronUp, X } from "lucide-vue-next";
import {
  defineComponent,
  ref,
  Teleport,
  Transition,
  TransitionGroup,
} from "vue";

export interface TaskQueuePanelProps {
  visible: boolean;
  isProcessing: boolean;
  onClose: () => void;
}

export interface TaskQueuePanelSlots<T> {
  icon: () => VNode;
  title: () => VNode;
  item: (props: { task: T }) => VNode;
  footer?: () => VNode;
}

export const TaskQueuePanel = defineComponent({
  name: "TaskQueuePanel",
  props: {
    visible: {
      type: Boolean,
      required: true,
    },
    isProcessing: {
      type: Boolean,
      required: true,
    },
    tasks: {
      type: Array as () => Array<{ id: string }>,
      required: true,
    },
    closeTitle: {
      type: String,
      default: "关闭",
    },
    showCloseWhenProcessing: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close"],
  setup(props, { emit, slots }) {
    const collapsed = ref(false);

    const handleClose = () => {
      emit("close");
    };

    const toggleCollapse = () => {
      collapsed.value = !collapsed.value;
    };

    const onBeforeEnter = (el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.height = "0";
      htmlEl.style.opacity = "0";
    };

    const onEnter = (el: Element, done: () => void) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.transition = "height 0.2s ease-out, opacity 0.2s ease-out";
      htmlEl.style.height = `${htmlEl.scrollHeight}px`;
      htmlEl.style.opacity = "1";
      htmlEl.addEventListener("transitionend", done, { once: true });
    };

    const onAfterEnter = (el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.height = "";
      htmlEl.style.transition = "";
    };

    const onBeforeLeave = (el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.height = `${htmlEl.scrollHeight}px`;
      htmlEl.style.opacity = "1";
    };

    const onLeave = (el: Element, done: () => void) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.transition = "height 0.15s ease-in, opacity 0.15s ease-in";
      requestAnimationFrame(() => {
        htmlEl.style.height = "0";
        htmlEl.style.opacity = "0";
      });
      htmlEl.addEventListener("transitionend", done, { once: true });
    };

    const onAfterLeave = (el: Element) => {
      const htmlEl = el as HTMLElement;
      htmlEl.style.height = "";
      htmlEl.style.transition = "";
    };

    return () => (
      <Teleport to="body">
        <Transition
          enterActiveClass="transition-all duration-300 ease-out"
          enterFromClass="opacity-0 translate-y-4"
          enterToClass="opacity-100 translate-y-0"
          leaveActiveClass="transition-all duration-200 ease-in"
          leaveFromClass="opacity-100 translate-y-0"
          leaveToClass="opacity-0 translate-y-4"
        >
          {props.visible && props.tasks.length > 0 && (
            <div class="w-[500px] bottom-4 right-4 fixed z-50 phone:w-full phone:shadow-[0_-4px_16px_rgba(0,0,0,0.08)] phone:bottom-0 phone:left-0 phone:right-0 dark:phone:shadow-[0_-4px_16px_rgba(0,0,0,0.3)]">
              <div class="border border-neutral-200 rounded-lg bg-white shadow-xl overflow-hidden phone:border-x-0 phone:border-b-0 dark:border-neutral-700 phone:rounded-b-none dark:bg-neutral-900 phone:shadow-none">
                {/* Header */}
                <div
                  class="px-4 py-3 flex cursor-pointer select-none items-center justify-between phone:px-3 phone:py-2.5"
                  onClick={toggleCollapse}
                >
                  <div class="flex gap-2.5 items-center phone:gap-2">
                    <div class="rounded-md bg-neutral-100 flex size-6 items-center justify-center dark:bg-neutral-800 phone:size-5">
                      {slots.icon?.()}
                    </div>
                    <span class="text-sm text-neutral-900 font-medium phone:text-xs dark:text-neutral-100">
                      {slots.title?.()}
                    </span>
                  </div>
                  <div class="flex gap-1 items-center">
                    <button
                      class="text-neutral-400 p-1 rounded transition-colors hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        toggleCollapse();
                      }}
                      title={collapsed.value ? "展开" : "折叠"}
                    >
                      {collapsed.value
                        ? (
                            <ChevronUp class="size-4 phone:size-3.5" />
                          )
                        : (
                            <ChevronDown class="size-4 phone:size-3.5" />
                          )}
                    </button>
                    {(props.showCloseWhenProcessing || !props.isProcessing) && (
                      <button
                        class="text-neutral-400 p-1 rounded transition-colors hover:text-neutral-600 hover:bg-neutral-100 dark:hover:text-neutral-300 dark:hover:bg-neutral-800"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          handleClose();
                        }}
                        title={props.closeTitle}
                      >
                        <X class="size-4 phone:size-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <Transition
                  onBeforeEnter={onBeforeEnter}
                  onEnter={onEnter}
                  onAfterEnter={onAfterEnter}
                  onBeforeLeave={onBeforeLeave}
                  onLeave={onLeave}
                  onAfterLeave={onAfterLeave}
                  css={false}
                >
                  {!collapsed.value && (
                    <div class="border-t border-neutral-100 overflow-hidden dark:border-neutral-800">
                      <div class="px-4 py-2 h-[600px] overflow-y-auto phone:px-3 phone:py-1.5 phone:h-[50vh]">
                        <TransitionGroup
                          moveClass="transition-all duration-200"
                          enterActiveClass="transition-all duration-200"
                          enterFromClass="opacity-0 -translate-x-2"
                          enterToClass="opacity-100 translate-x-0"
                        >
                          {props.tasks.map(task => (
                            <div key={task.id}>{slots.item?.({ task })}</div>
                          ))}
                        </TransitionGroup>
                      </div>
                      {slots.footer?.()}
                    </div>
                  )}
                </Transition>
              </div>
            </div>
          )}
        </Transition>
      </Teleport>
    );
  },
});
