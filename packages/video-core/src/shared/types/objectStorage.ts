import type { AssetItem } from './assets'

export type ObjectStorageVendor = 'aliyun-oss' | 'volcengine-tos' | 'tencent-cos'

export type ObjectStorageAuthMode = 'long_term_key' | 'sts'

export type ObjectStorageConfig = {
  enabled: boolean
  vendor: ObjectStorageVendor
  authMode: ObjectStorageAuthMode
  accessKeyId?: string | undefined
  accessKeySecret?: string | undefined
  secretId?: string | undefined
  secretKey?: string | undefined
  securityToken?: string | undefined
  stsToken?: string | undefined
  stsEndpointUrl?: string | undefined
  stsRequestHeaders?: string | undefined
  credentialRefreshBeforeExpireSeconds: number
  region: string
  endpoint?: string | undefined
  bucket: string
  keyPrefix?: string | undefined
  publicDomain?: string | undefined
  generatePublicUrl: boolean
  autoCreateSeedanceAsset: boolean
  autoPollAssetActive: boolean
}

export type TemporaryCredentials = {
  accessKeyId?: string | undefined
  accessKeySecret?: string | undefined
  secretId?: string | undefined
  secretKey?: string | undefined
  securityToken?: string | undefined
  stsToken?: string | undefined
  expiration?: string | undefined
}

export type ObjectStorageUploadResult = {
  vendor: ObjectStorageVendor
  bucket: string
  key: string
  url: string
  publicUrl: string
  etag?: string | undefined
  size: number
  mimeType: string
}

export type ObjectStorageTestResult = {
  ok: boolean
  message: string
}

export type LocalFileUploadRequest = {
  groupId?: number | undefined
  assetType: 'Image' | 'Video' | 'Audio'
  name?: string | undefined
  filePath?: string | undefined
  fileName?: string | undefined
  mimeType?: string | undefined
  bytes?: ArrayBuffer | undefined
}

export type LocalFileUploadResult = {
  cancelled: boolean
  storage?: ObjectStorageUploadResult | undefined
  asset?: AssetItem | undefined
  errorMessage?: string | undefined
}
