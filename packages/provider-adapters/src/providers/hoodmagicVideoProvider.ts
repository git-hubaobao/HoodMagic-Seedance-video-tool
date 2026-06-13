import {
  getContentText,
  normalizeVideoTaskStatus,
  type VideoGenerationRequest,
  type VideoProviderConfig,
  type VideoTask
} from '@hoodmagic/video-core'

import {
  asRecord,
  authHeaders,
  boolValue,
  extractErrorMessage,
  extractLastFrameUrl,
  extractUsage,
  extractVideoUrl,
  getFetch,
  getPath,
  joinUrl,
  requestJson,
  secondsToIso,
  stringValue,
  toProviderContent,
  type FetchLike
} from '../common'
import type { VideoProviderAdapter } from './types'

export const buildHoodMagicVideoRequestBody = (request: VideoGenerationRequest): Record<string, unknown> => {
  const prompt = request.prompt.trim() || getContentText(request.content) || 'video_generation'
  const metadata: Record<string, unknown> = {
    content: toProviderContent(request.content),
    duration: request.duration,
    resolution: request.resolution,
    ratio: request.ratio,
    generate_audio: request.generateAudio
  }

  if (request.seed !== undefined) {
    metadata.seed = request.seed
  }

  if (request.watermark !== undefined) {
    metadata.watermark = request.watermark
  }

  if (request.returnLastFrame !== undefined) {
    metadata.return_last_frame = request.returnLastFrame
  }

  if (request.tools?.length) {
    metadata.tools = request.tools
  }

  if (request.callbackUrl?.trim()) {
    metadata.callback_url = request.callbackUrl.trim()
  }

  return {
    model: request.model,
    prompt,
    metadata
  }
}

export const mapHoodMagicTaskResponse = (
  responseBody: unknown,
  fallback: Pick<VideoTask, 'provider' | 'model' | 'createdAt' | 'updatedAt'> & Partial<VideoTask>
): VideoTask => {
  const root = asRecord(responseBody)
  const data = asRecord(root.data)
  const nestedData = asRecord(data.data)
  const rawStatus = stringValue(data.status) ?? stringValue(nestedData.status) ?? fallback.rawStatus ?? 'queued'
  const status = normalizeVideoTaskStatus(rawStatus)
  const id =
    stringValue(root.task_id) ??
    stringValue(data.task_id) ??
    stringValue(nestedData.id) ??
    fallback.id ??
    stringValue(root.id) ??
    'unknown-task'
  const errorObject = asRecord(nestedData.error)
  const failReason = stringValue(data.fail_reason)
  const errorMessage = failReason ?? stringValue(errorObject.message) ?? stringValue(getPath(root, ['error', 'message']))
  const errorCode = stringValue(errorObject.code) ?? stringValue(getPath(root, ['error', 'code']))
  const now = new Date().toISOString()
  const usage = extractUsage(nestedData.usage)

  return {
    ...fallback,
    id,
    provider: 'hoodmagic',
    providerTaskId: id,
    status,
    rawStatus,
    model: stringValue(nestedData.model) ?? fallback.model,
    progress: stringValue(data.progress) ?? fallback.progress,
    videoUrl: extractVideoUrl(root) ?? fallback.videoUrl,
    lastFrameUrl: extractLastFrameUrl(root) ?? fallback.lastFrameUrl,
    usage: usage ?? fallback.usage,
    generateAudio: boolValue(nestedData.generate_audio),
    updatedAt: now,
    completedAt: status === 'succeeded' || status === 'failed' || status === 'cancelled' ? now : fallback.completedAt,
    ...(errorMessage ? { error: { ...(errorCode ? { code: errorCode } : {}), message: errorMessage } } : {}),
    raw: responseBody
  } as VideoTask
}

export const createHoodMagicVideoProvider = (fetchLike?: FetchLike): VideoProviderAdapter => {
  const runFetch = getFetch(fetchLike)

  return {
    type: 'hoodmagic',
    async createTask(request, config) {
      const body = buildHoodMagicVideoRequestBody(request)
      const responseBody = await requestJson(
        runFetch,
        joinUrl(config.baseUrl, '/v1/video/generations'),
        {
          method: 'POST',
          headers: authHeaders(config.apiKey),
          body: JSON.stringify(body)
        },
        'hoodmagic_create_task_failed'
      )
      const now = new Date().toISOString()

      return mapHoodMagicTaskResponse(responseBody, {
        id: stringValue(getPath(responseBody, ['task_id'])) ?? stringValue(getPath(responseBody, ['data', 'task_id'])) ?? `hm-${Date.now()}`,
        provider: 'hoodmagic',
        status: 'queued',
        model: request.model,
        prompt: request.prompt,
        mode: request.mode,
        request,
        createdAt: now,
        updatedAt: now
      })
    },
    async getTask(taskId, config, previousTask) {
      const responseBody = await requestJson(
        runFetch,
        joinUrl(config.baseUrl, `/v1/video/generations/${encodeURIComponent(taskId)}`),
        {
          method: 'GET',
          headers: authHeaders(config.apiKey)
        },
        'hoodmagic_get_task_failed'
      )
      const now = new Date().toISOString()

      return mapHoodMagicTaskResponse(responseBody, {
        id: taskId,
        provider: 'hoodmagic',
        status: previousTask?.status ?? 'unknown',
        model: previousTask?.model ?? config.defaultModel,
        createdAt: previousTask?.createdAt ?? now,
        updatedAt: now,
        ...(previousTask?.prompt !== undefined ? { prompt: previousTask.prompt } : {}),
        ...(previousTask?.mode !== undefined ? { mode: previousTask.mode } : {}),
        ...(previousTask?.request !== undefined ? { request: previousTask.request } : {}),
        ...(previousTask?.progress !== undefined ? { progress: previousTask.progress } : {}),
        ...(previousTask?.videoUrl !== undefined ? { videoUrl: previousTask.videoUrl } : {}),
        ...(previousTask?.lastFrameUrl !== undefined ? { lastFrameUrl: previousTask.lastFrameUrl } : {}),
        ...(previousTask?.usage !== undefined ? { usage: previousTask.usage } : {})
      })
    },
    async cancelTask(taskId, config, previousTask) {
      const responseBody = await requestJson(
        runFetch,
        joinUrl(config.baseUrl, `/v1/videos/${encodeURIComponent(taskId)}`),
        {
          method: 'DELETE',
          headers: authHeaders(config.apiKey)
        },
        'hoodmagic_cancel_task_failed'
      )

      const now = new Date().toISOString()
      if (responseBody === undefined) {
        return previousTask
          ? {
              ...previousTask,
              status: 'cancelled',
              rawStatus: 'cancelled',
              updatedAt: now,
              completedAt: now
            }
          : undefined
      }

      const mapped = mapHoodMagicTaskResponse(responseBody, {
        id: taskId,
        provider: 'hoodmagic',
        status: 'cancelled',
        model: previousTask?.model ?? config.defaultModel,
        createdAt: previousTask?.createdAt ?? secondsToIso(getPath(responseBody, ['created_at'])) ?? now,
        updatedAt: now,
        ...(previousTask?.prompt !== undefined ? { prompt: previousTask.prompt } : {}),
        ...(previousTask?.mode !== undefined ? { mode: previousTask.mode } : {}),
        ...(previousTask?.request !== undefined ? { request: previousTask.request } : {})
      })

      return {
        ...mapped,
        status: mapped.status === 'unknown' ? 'cancelled' : mapped.status
      }
    }
  }
}
