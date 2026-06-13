import { randomUUID } from 'node:crypto'
import { extname, parse } from 'node:path'

import type {
  ObjectStorageConfig,
  ObjectStorageTestResult,
  ObjectStorageUploadResult,
  TemporaryCredentials
} from '@hoodmagic/video-core'

import { createAliyunOssProvider } from './aliyunOssProvider'
import { createTencentCosProvider } from './tencentCosProvider'
import { createVolcengineTosProvider } from './volcengineTosProvider'
import type { ObjectStorageProvider, UploadFileInput } from './objectStorageTypes'

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, '')

const safeFilename = (fileName: string): string => {
  const parsed = parse(fileName)
  const extension = parsed.ext || extname(fileName)
  const baseName = (parsed.name || 'asset')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80)

  return `${baseName || 'asset'}${extension.toLowerCase()}`
}

const getDateParts = (): { yyyy: string; MM: string; dd: string } => {
  const now = new Date()
  return {
    yyyy: String(now.getFullYear()),
    MM: String(now.getMonth() + 1).padStart(2, '0'),
    dd: String(now.getDate()).padStart(2, '0')
  }
}

export const normalizeObjectKey = (prefix: string | undefined, fileName: string): string => {
  const { yyyy, MM, dd } = getDateParts()
  const normalizedPrefix = prefix?.trim() ? `${trimSlashes(prefix.trim())}/` : ''
  return `${normalizedPrefix}${yyyy}/${MM}/${dd}/${randomUUID()}-${safeFilename(fileName)}`
}

export const buildPublicUrl = (config: ObjectStorageConfig, key: string): string => {
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')

  if (config.publicDomain?.trim()) {
    return `${config.publicDomain.trim().replace(/\/+$/, '')}/${encodedKey}`
  }

  if (!config.generatePublicUrl) {
    throw new Error('对象存储已上传，但未启用公开访问 URL。请配置 publicDomain 或开启公开 URL。')
  }

  if (config.vendor === 'aliyun-oss') {
    const endpoint = config.endpoint?.trim()
    if (!endpoint) {
      throw new Error('阿里云 OSS 需要填写 endpoint 才能构造公网 URL。')
    }
    const normalizedEndpoint = endpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    return `https://${config.bucket}.${normalizedEndpoint}/${encodedKey}`
  }

  if (config.vendor === 'volcengine-tos') {
    const endpoint = config.endpoint?.trim()
    if (!endpoint) {
      throw new Error('火山 TOS 需要填写 endpoint 才能构造公网 URL。')
    }
    const normalizedEndpoint = endpoint.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    return `https://${config.bucket}.${normalizedEndpoint}/${encodedKey}`
  }

  return `https://${config.bucket}.cos.${config.region}.myqcloud.com/${encodedKey}`
}

const parseHeaders = (headersText: string | undefined): Record<string, string> => {
  if (!headersText?.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(headersText) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('STS 请求头必须是 JSON 对象。')
    }

    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'STS 请求头解析失败。')
  }
}

const findString = (value: unknown, keys: string[]): string | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined
  }

  const record = value as Record<string, unknown>
  for (const key of keys) {
    const match = record[key]
    if (typeof match === 'string' && match.trim()) {
      return match
    }
  }

  for (const child of Object.values(record)) {
    const match = findString(child, keys)
    if (match) {
      return match
    }
  }

  return undefined
}

export const getTemporaryCredentials = async (config: ObjectStorageConfig): Promise<TemporaryCredentials> => {
  if (!config.stsEndpointUrl?.trim()) {
    throw new Error('STS 模式需要填写获取临时凭证接口 URL。')
  }

  const response = await fetch(config.stsEndpointUrl.trim(), {
    method: 'GET',
    headers: parseHeaders(config.stsRequestHeaders)
  })
  const text = await response.text()
  const body = text ? (JSON.parse(text) as unknown) : undefined

  if (!response.ok) {
    throw new Error(`获取 STS 临时凭证失败：HTTP ${response.status}`)
  }

  return {
    accessKeyId: findString(body, ['accessKeyId', 'AccessKeyId', 'AccessKeyID', 'access_key_id']),
    accessKeySecret: findString(body, ['accessKeySecret', 'AccessKeySecret', 'access_key_secret']),
    secretId: findString(body, ['secretId', 'SecretId', 'secret_id']),
    secretKey: findString(body, ['secretKey', 'SecretKey', 'secret_key']),
    securityToken: findString(body, ['securityToken', 'SecurityToken', 'security_token', 'token', 'Token']),
    stsToken: findString(body, ['stsToken', 'SecurityToken', 'securityToken']),
    expiration: findString(body, ['expiration', 'Expiration', 'expireTime', 'expiredTime'])
  }
}

const assertConfigured = (config: ObjectStorageConfig): void => {
  if (!config.enabled) {
    throw new Error('未启用对象存储上传。请先在设置页开启对象存储。')
  }

  if (!config.vendor) {
    throw new Error('未选择对象存储云厂商。')
  }

  if (!config.bucket.trim()) {
    throw new Error('对象存储 bucket 不能为空。')
  }

  if (!config.region.trim()) {
    throw new Error('对象存储 region 不能为空。')
  }

  if (config.vendor !== 'tencent-cos' && !config.endpoint?.trim()) {
    throw new Error('对象存储 endpoint 不能为空。')
  }

  if (config.authMode === 'sts') {
    if (!config.stsEndpointUrl?.trim() && !config.securityToken && !config.stsToken) {
      throw new Error('STS 模式需要配置获取临时凭证接口 URL，或填写已有 securityToken/stsToken。')
    }
  }
}

export class ObjectStorageService {
  private readonly providers: Record<ObjectStorageConfig['vendor'], ObjectStorageProvider>

  constructor() {
    this.providers = {
      'aliyun-oss': createAliyunOssProvider(),
      'volcengine-tos': createVolcengineTosProvider(),
      'tencent-cos': createTencentCosProvider()
    }
  }

  async uploadFile(input: UploadFileInput, config: ObjectStorageConfig): Promise<ObjectStorageUploadResult> {
    assertConfigured(config)
    return this.providers[config.vendor].uploadFile(input, config)
  }

  async testConnection(config: ObjectStorageConfig): Promise<ObjectStorageTestResult> {
    assertConfigured(config)
    return this.providers[config.vendor].testConnection(config)
  }
}
