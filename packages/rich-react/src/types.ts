import type { useAgentLoop } from '@haklex/rich-ext-ai-agent'
import type { ShiroEditorProps } from './shiro'

export type SaveExcalidrawSnapshot = (
  snapshot: object,
  existingRef?: string,
) => Promise<string>

// Admin-safe alias so consumers don't need to depend on React-bound types
export type ImageUpload = NonNullable<ShiroEditorProps['imageUpload']>

export type AgentLoopHandle = ReturnType<typeof useAgentLoop>

export interface EnrichmentImage {
  url: string
  width?: number
  height?: number
  alt?: string
  blurhash?: string
}

export interface EnrichmentAttribute {
  key: string
  value: string | number | boolean
  label?: string
  format?: 'number' | 'rating' | 'date' | 'percent' | 'text' | 'duration'
}

export interface EnrichmentResult {
  title: string
  description?: string
  image?: EnrichmentImage
  url: string
  category: string
  subtype?: string
  publishedAt?: string
  fetchedAt?: string
  attributes?: EnrichmentAttribute[]
  color?: string
  links?: Array<{ rel: string; url: string; label?: string }>
}
