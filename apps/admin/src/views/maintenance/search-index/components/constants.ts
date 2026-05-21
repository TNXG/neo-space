import type { SearchIndexRefType } from '~/models/search-index'

export const refTypeOptions: Array<{
  label: string
  value: SearchIndexRefType | undefined
}> = [
  { label: '全部类型', value: undefined },
  { label: '博文 post', value: 'post' },
  { label: '手记 note', value: 'note' },
  { label: '页面 page', value: 'page' },
]

export const refTypeLabel: Record<string, string> = {
  post: '博文',
  note: '手记',
  page: '页面',
}

export const refTypeTone: Record<
  string,
  'info' | 'success' | 'warning' | 'default'
> = {
  post: 'info',
  note: 'success',
  page: 'warning',
}

export const buildEditUrl = (refType: string, refId: string): string | null => {
  switch (refType) {
    case 'post':
      return `/posts/edit?id=${encodeURIComponent(refId)}`
    case 'note':
      return `/notes/edit?id=${encodeURIComponent(refId)}`
    case 'page':
      return `/pages/edit?id=${encodeURIComponent(refId)}`
    default:
      return null
  }
}
