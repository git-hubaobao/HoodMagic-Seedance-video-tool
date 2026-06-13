import type OSS from 'ali-oss'

import type { ObjectStorageConfig, ObjectStorageTestResult, ObjectStorageUploadResult } from '@hoodmagic/video-core'

import { buildPublicUrl, getTemporaryCredentials, normalizeObjectKey } from './objectStorageService'
import type { ObjectStorageProvider, UploadFileInput } from './objectStorageTypes'

type AliOssClient = InstanceType<typeof OSS>

const createClient = async (config: ObjectStorageConfig): Promise<AliOssClient> => {
  const module = await import('ali-oss')
  const OssClient = module.default
  const temporaryCredentials = config.authMode === 'sts' && config.stsEndpointUrl?.trim()
    ? await getTemporaryCredentials(config)
    : {}
  const accessKeyId = temporaryCredentials.accessKeyId ?? config.accessKeyId
  const accessKeySecret = temporaryCredentials.accessKeySecret ?? config.accessKeySecret
  const stsToken = temporaryCredentials.stsToken ?? temporaryCredentials.securityToken ?? config.stsToken ?? config.securityToken

  if (!accessKeyId?.trim() || !accessKeySecret?.trim()) {
    throw new Error(config.authMode === 'sts' ? '未获取到 STS accessKeyId/accessKeySecret。' : '阿里云 OSS AccessKeyId/AccessKeySecret 不能为空。')
  }

  return new OssClient({
    region: config.region,
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId,
    accessKeySecret,
    ...(stsToken ? { stsToken } : {})
  })
}

export const createAliyunOssProvider = (): ObjectStorageProvider => ({
  async uploadFile(input: UploadFileInput, config: ObjectStorageConfig): Promise<ObjectStorageUploadResult> {
    const client = await createClient(config)
    const key = normalizeObjectKey(config.keyPrefix, input.fileName)
    const result = await client.put(key, input.filePath, {
      headers: {
        'Content-Type': input.mimeType
      }
    })
    const publicUrl = buildPublicUrl(config, key)

    return {
      vendor: 'aliyun-oss',
      bucket: config.bucket,
      key,
      url: typeof result.url === 'string' ? result.url : publicUrl,
      publicUrl,
      ...(typeof result.res?.headers?.etag === 'string' ? { etag: result.res.headers.etag } : {}),
      size: input.size,
      mimeType: input.mimeType
    }
  },

  async testConnection(config: ObjectStorageConfig): Promise<ObjectStorageTestResult> {
    const client = await createClient(config)
    await client.list({
      'max-keys': 1
    })

    return {
      ok: true,
      message: '阿里云 OSS 连接测试成功。'
    }
  }
})
