export type {
  AgentLoopHandle,
  EnrichmentAttribute,
  EnrichmentImage,
  EnrichmentResult,
  ImageUpload,
  SaveExcalidrawSnapshot,
} from './types'

export type { EnrichmentFetcher } from './components/EnrichmentLinkCardContext'

export { NestedDocDialogEditor } from './components/NestedDocDialogEditor'
export {
  ShiroEditorBridge,
  type ShiroEditorBridgeProps,
} from './components/ShiroEditorBridge'

export {
  buildShiroEditorProps,
  type BuildShiroEditorPropsInput,
} from './utils/build-shiro-editor-props'
export { applyAgentReviewBatch } from './utils/apply-agent-review-batch'

export {
  mountRichEditor,
  type MountRichEditorOptions,
  type RichEditorHandle,
} from './mount/mount-rich-editor'
export {
  mountRichDiff,
  type MountRichDiffOptions,
  type RichDiffHandle,
} from './mount/mount-rich-diff'
export {
  mountRichEditorWithAgent,
  type MountRichEditorWithAgentOptions,
  type RichEditorWithAgentHandle,
} from './mount/mount-rich-editor-with-agent'
