import type { Image } from '~/models/base'

export type ContentFormat = 'markdown' | 'lexical'

export type WriteBaseType = {
  title: string
  text: string
  contentFormat?: ContentFormat
  content?: string

  id?: string
  images: Image[]
  createdAt?: string
  modifiedAt?: string

  meta?: any
}
