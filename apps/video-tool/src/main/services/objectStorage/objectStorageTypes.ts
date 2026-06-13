import type {
  ObjectStorageConfig,
  ObjectStorageTestResult,
  ObjectStorageUploadResult,
  TemporaryCredentials
} from '@hoodmagic/video-core'

export type UploadFileInput = {
  filePath: string
  fileName: string
  mimeType: string
  size: number
}

export type ObjectStorageProvider = {
  uploadFile(input: UploadFileInput, config: ObjectStorageConfig): Promise<ObjectStorageUploadResult>
  testConnection(config: ObjectStorageConfig): Promise<ObjectStorageTestResult>
}

export type ObjectStorageRuntimeCredentials = TemporaryCredentials & {
  accessKeyId?: string
  accessKeySecret?: string
  secretId?: string
  secretKey?: string
}
