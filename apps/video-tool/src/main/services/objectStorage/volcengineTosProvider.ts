import type { ObjectStorageConfig, ObjectStorageTestResult, ObjectStorageUploadResult } from '@hoodmagic/video-core'

import type { ObjectStorageProvider, UploadFileInput } from './objectStorageTypes'

const notImplemented = (): Error =>
  new Error('火山 TOS 对象存储上传已预留配置入口，当前版本尚未接入 SDK。请先使用阿里云 OSS，或后续安装 TOS SDK 后启用。')

export const createVolcengineTosProvider = (): ObjectStorageProvider => ({
  uploadFile(_input: UploadFileInput, _config: ObjectStorageConfig): Promise<ObjectStorageUploadResult> {
    return Promise.reject(notImplemented())
  },

  testConnection(_config: ObjectStorageConfig): Promise<ObjectStorageTestResult> {
    return Promise.reject(notImplemented())
  }
})
