import { request } from '~/utils/request'

export interface UploadResult {
  url: string
  name: string
}

/**
 * 简化的上传 API：仅供富文本 / Markdown 编辑器内联上传图片或附件使用。
 * 前台不再提供完整的「文件管理 / 孤儿图片」面板。
 */
export const uploadApi = {
  upload: async (file: File, type: 'image' | 'file' = 'image') => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    return request.post<UploadResult, FormData>('/files/upload', {
      data: formData,
    })
  },

  /**
   * 替换已存在文件（编辑器粘贴覆盖时使用）。
   */
  update: async (
    type: 'image' | 'file',
    name: string,
    file: File,
  ): Promise<UploadResult> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)
    formData.append('name', name)
    return request.put<UploadResult, FormData>('/files/upload', {
      data: formData,
    })
  },
}

// 为兼容现有编辑器代码，保留 filesApi 别名
export const filesApi = uploadApi
