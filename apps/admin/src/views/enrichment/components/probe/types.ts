import type { EnrichmentProbeResult } from '~/models/enrichment'

export interface ProbeHistoryEntry {
  id: string
  url: string
  useCache: boolean
  result: EnrichmentProbeResult
  at: Date
}
