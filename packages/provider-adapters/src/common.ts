import type { VideoContentItem, VideoTaskUsage } from '@hoodmagic/video-core'

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export class VideoProviderError extends Error {
  code: string
  status?: number
  responseBody?: unknown

  constructor(code: string, message: string, options: { status?: number; responseBody?: unknown } = {}) {
    super(message)
    this.name = 'VideoProviderError'
    this.code = code
    if (options.status !== undefined) {
      this.status = options.status
    }
    if (options.responseBody !== undefined) {
      this.responseBody = options.responseBody
    }
  }
}

export const getFetch = (fetchLike?: FetchLike): FetchLike => {
  if (fetchLike) {
    return fetchLike
  }

  if (typeof fetch === 'function') {
    return fetch
  }

  throw new VideoProviderError('fetch_unavailable', 'fetch is not available in this runtime.')
}

export const joinUrl = (baseUrl: string, path: string): string => {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBaseUrl}${normalizedPath}`
}

export const authHeaders = (apiKey: string): Record<string, string> => ({
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json; charset=utf-8'
})

export const parseJsonResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text()
  if (!text.trim()) {
    return undefined
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export const requestJson = async (
  fetchLike: FetchLike,
  url: string,
  init: RequestInit,
  errorCode: string
): Promise<unknown> => {
  const response = await fetchLike(url, init)
  const body = await parseJsonResponse(response)

  if (!response.ok) {
    throw new VideoProviderError(errorCode, extractErrorMessage(body, `HTTP ${response.status}`), {
      status: response.status,
      responseBody: body
    })
  }

  return body
}

export const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export const getPath = (value: unknown, path: readonly string[]): unknown => {
  let current: unknown = value
  for (const part of path) {
    const record = asRecord(current)
    current = record[part]
  }

  return current
}

export const stringValue = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined
}

export const numberValue = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export const boolValue = (value: unknown): boolean | undefined => {
  return typeof value === 'boolean' ? value : undefined
}

export const secondsToIso = (value: unknown): string | undefined => {
  const seconds = numberValue(value)
  return seconds === undefined ? undefined : new Date(seconds * 1000).toISOString()
}

export const extractErrorMessage = (value: unknown, fallback = 'Request failed.'): string => {
  const directMessage = stringValue(getPath(value, ['error', 'message'])) ?? stringValue(getPath(value, ['message']))
  return directMessage ?? fallback
}

export const extractUsage = (value: unknown): VideoTaskUsage | undefined => {
  const usage = asRecord(value)
  const totalTokens = numberValue(usage.total_tokens)
  const completionTokens = numberValue(usage.completion_tokens)
  const webSearch = numberValue(getPath(usage, ['tool_usage', 'web_search']))

  if (totalTokens === undefined && completionTokens === undefined && webSearch === undefined) {
    return undefined
  }

  return {
    ...(totalTokens !== undefined ? { totalTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(webSearch !== undefined ? { toolUsage: { webSearch } } : {})
  }
}

const urlFromUnknown = (value: unknown): string | undefined => {
  const direct = stringValue(value)
  if (direct) {
    return direct
  }

  return stringValue(getPath(value, ['url']))
}

const findUrlByKey = (value: unknown, keys: readonly string[]): string | undefined => {
  const record = asRecord(value)
  for (const [key, child] of Object.entries(record)) {
    if (keys.includes(key)) {
      const match = urlFromUnknown(child)
      if (match) {
        return match
      }
    }
  }

  for (const child of Object.values(record)) {
    if (child && typeof child === 'object') {
      const match = findUrlByKey(child, keys)
      if (match) {
        return match
      }
    }
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      const match = findUrlByKey(child, keys)
      if (match) {
        return match
      }
    }
  }

  return undefined
}

export const extractVideoUrl = (value: unknown): string | undefined => {
  const preferredPaths: string[][] = [
    ['content', 'video_url'],
    ['content', 'videoUrl'],
    ['output', 'video_url'],
    ['output', 'videoUrl'],
    ['result', 'video_url'],
    ['result', 'videoUrl'],
    ['data', 'video_url'],
    ['data', 'videoUrl'],
    ['data', 'content', 'video_url'],
    ['data', 'content', 'videoUrl'],
    ['data', 'data', 'content', 'video_url'],
    ['data', 'data', 'content', 'videoUrl']
  ]

  for (const path of preferredPaths) {
    const match = urlFromUnknown(getPath(value, path))
    if (match) {
      return match
    }
  }

  return findUrlByKey(value, ['video_url', 'videoUrl'])
}

export const extractLastFrameUrl = (value: unknown): string | undefined => {
  const preferredPaths: string[][] = [
    ['content', 'last_frame_url'],
    ['content', 'lastFrameUrl'],
    ['output', 'last_frame_url'],
    ['output', 'lastFrameUrl'],
    ['result', 'last_frame_url'],
    ['result', 'lastFrameUrl'],
    ['data', 'last_frame_url'],
    ['data', 'lastFrameUrl'],
    ['data', 'content', 'last_frame_url'],
    ['data', 'content', 'lastFrameUrl'],
    ['data', 'data', 'content', 'last_frame_url'],
    ['data', 'data', 'content', 'lastFrameUrl']
  ]

  for (const path of preferredPaths) {
    const match = urlFromUnknown(getPath(value, path))
    if (match) {
      return match
    }
  }

  return findUrlByKey(value, ['last_frame_url', 'lastFrameUrl'])
}

export const toProviderContent = (content: readonly VideoContentItem[]): VideoContentItem[] => {
  return content.map((item) => {
    if (item.type === 'text') {
      return { type: item.type, text: item.text }
    }

    if (item.type === 'image_url') {
      return {
        type: item.type,
        image_url: { url: item.image_url.url },
        ...(item.role ? { role: item.role } : {})
      }
    }

    if (item.type === 'video_url') {
      return {
        type: item.type,
        video_url: { url: item.video_url.url },
        role: item.role
      }
    }

    return {
      type: item.type,
      audio_url: { url: item.audio_url.url },
      role: item.role
    }
  })
}
