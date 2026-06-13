import {
  getContentText,
  normalizeVideoTaskStatus,
  type VideoGenerationRequest,
  type VideoProviderConfig,
  type VideoTask,
  type VideoTaskListFilter
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
  requestJson,
  secondsToIso,
  stringValue,
  toProviderContent,
  type FetchLike,
  VideoProviderError
} from '../common'
import type { VideoProviderAdapter } from './types'

const DEFAULT_VOLCENGINE_BASE_URL = 'https://ark.cn-beijing.volces.com'

export const getVolcengineTasksUrl = (baseUrl?: string): string => {
  const base = (baseUrl?.trim() || DEFAULT_VOLCENGINE_BASE_URL).replace(/\/+$/, '')

  if (/\/api\/v3\/contents\/generations\/tasks$/i.test(base)) {
    return base
  }

  if (/\/api\/v3\/contents\/generations$/i.test(base)) {
    return `${base}/tasks`
  }

  return `${base}/api/v3/contents/generations/tasks`
}

export const buildVolcengineSeedanceRequestBody = (request: VideoGenerationRequest): Record<string, unknown> => {
  const content = toProviderContent(request.content)
  const text = getContentText(request.content)

  return {
    model: request.model,
    content,
    resolution: request.resolution,
    ratio: request.ratio,
    duration: request.duration,
    generate_audio: request.generateAudio,
    ...(request.seed !== undefined ? { seed: request.seed } : {}),
    ...(request.watermark !== undefined ? { watermark: request.watermark } : {}),
    ...(request.returnLastFrame !== undefined ? { return_last_frame: request.returnLastFrame } : {}),
    ...(request.tools?.length ? { tools: request.tools } : {}),
    ...(request.callbackUrl?.trim() ? { callback_url: request.callbackUrl.trim() } : {}),
    ...(text ? { prompt_preview: text } : {})
  }
}

export const mapVolcengineTaskResponse = (
  responseBody: unknown,
  fallback: Pick<VideoTask, 'provider' | 'model' | 'createdAt' | 'updatedAt'> & Partial<VideoTask>
): VideoTask => {
  const root = asRecord(responseBody)
  const rawStatus = stringValue(root.status) ?? fallback.rawStatus ?? 'queued'
  const status = normalizeVideoTaskStatus(rawStatus)
  const id = stringValue(root.id) ?? fallback.id ?? 'unknown-task'
  const errorMessage = stringValue(getPath(root, ['error', 'message'])) ?? fallback.error?.message
  const errorCode = stringValue(getPath(root, ['error', 'code'])) ?? fallback.error?.code
  const createdAt = secondsToIso(root.created_at) ?? fallback.createdAt
  const updatedAt = secondsToIso(root.updated_at) ?? new Date().toISOString()
  const usage = extractUsage(root.usage)

  return {
    ...fallback,
    id,
    provider: 'volcengine',
    providerTaskId: id,
    status,
    rawStatus,
    model: stringValue(root.model) ?? fallback.model,
    videoUrl: extractVideoUrl(root) ?? fallback.videoUrl,
    lastFrameUrl: extractLastFrameUrl(root) ?? fallback.lastFrameUrl,
    usage: usage ?? fallback.usage,
    createdAt,
    updatedAt,
    completedAt: status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'expired' ? updatedAt : fallback.completedAt,
    ...(errorMessage ? { error: { ...(errorCode ? { code: errorCode } : {}), message: errorMessage } } : {}),
    raw: responseBody
  } as VideoTask
}

const appendListFilter = (url: URL, filter?: VideoTaskListFilter): void => {
  if (!filter) {
    return
  }

  if (filter.pageNumber) {
    url.searchParams.set('page_num', String(filter.pageNumber))
  }

  if (filter.pageSize) {
    url.searchParams.set('page_size', String(filter.pageSize))
  }

  if (filter.status) {
    url.searchParams.set('filter.status', filter.status)
  }

  if (filter.model) {
    url.searchParams.set('filter.model', filter.model)
  }

  for (const taskId of filter.taskIds ?? []) {
    url.searchParams.append('filter.task_ids', taskId)
  }
}

export const createVolcengineSeedanceProvider = (fetchLike?: FetchLike): VideoProviderAdapter => {
  const runFetch = getFetch(fetchLike)

  return {
    type: 'volcengine',
    async createTask(request, config) {
      const responseBody = await requestJson(
        runFetch,
        getVolcengineTasksUrl(config.baseUrl),
        {
          method: 'POST',
          headers: authHeaders(config.apiKey),
          body: JSON.stringify(buildVolcengineSeedanceRequestBody(request))
        },
        'volcengine_create_task_failed'
      )
      const now = new Date().toISOString()

      return mapVolcengineTaskResponse(responseBody, {
        id: stringValue(getPath(responseBody, ['id'])) ?? `ve-${Date.now()}`,
        provider: 'volcengine',
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
        `${getVolcengineTasksUrl(config.baseUrl)}/${encodeURIComponent(taskId)}`,
        {
          method: 'GET',
          headers: authHeaders(config.apiKey)
        },
        'volcengine_get_task_failed'
      )
      const now = new Date().toISOString()

      return mapVolcengineTaskResponse(responseBody, {
        id: taskId,
        provider: 'volcengine',
        status: previousTask?.status ?? 'unknown',
        model: previousTask?.model ?? config.defaultModel,
        createdAt: previousTask?.createdAt ?? now,
        updatedAt: now,
        ...(previousTask?.prompt !== undefined ? { prompt: previousTask.prompt } : {}),
        ...(previousTask?.mode !== undefined ? { mode: previousTask.mode } : {}),
        ...(previousTask?.request !== undefined ? { request: previousTask.request } : {}),
        ...(previousTask?.videoUrl !== undefined ? { videoUrl: previousTask.videoUrl } : {}),
        ...(previousTask?.lastFrameUrl !== undefined ? { lastFrameUrl: previousTask.lastFrameUrl } : {}),
        ...(previousTask?.usage !== undefined ? { usage: previousTask.usage } : {})
      })
    },
    async cancelTask(taskId, config, previousTask) {
      if (previousTask && previousTask.status !== 'queued') {
        throw new VideoProviderError(
          'volcengine_cancel_only_queued',
          'Volcengine official API can only cancel queued tasks. Running tasks cannot be cancelled; completed tasks would be deleted instead.'
        )
      }

      await requestJson(
        runFetch,
        `${getVolcengineTasksUrl(config.baseUrl)}/${encodeURIComponent(taskId)}`,
        {
          method: 'DELETE',
          headers: authHeaders(config.apiKey)
        },
        'volcengine_cancel_task_failed'
      )

      const now = new Date().toISOString()
      return previousTask
        ? {
            ...previousTask,
            status: 'cancelled',
            rawStatus: 'cancelled',
            updatedAt: now,
            completedAt: now
          }
        : undefined
    },
    async listTasks(config, filter) {
      const url = new URL(getVolcengineTasksUrl(config.baseUrl))
      appendListFilter(url, filter)
      const responseBody = await requestJson(
        runFetch,
        url.toString(),
        {
          method: 'GET',
          headers: authHeaders(config.apiKey)
        },
        'volcengine_list_tasks_failed'
      )
      const items = Array.isArray(asRecord(responseBody).items) ? (asRecord(responseBody).items as unknown[]) : []

      return items.map((item) =>
        mapVolcengineTaskResponse(item, {
          id: stringValue(getPath(item, ['id'])) ?? `ve-${Date.now()}`,
          provider: 'volcengine',
          status: 'unknown',
          model: stringValue(getPath(item, ['model'])) ?? config.defaultModel,
          createdAt: secondsToIso(getPath(item, ['created_at'])) ?? new Date().toISOString(),
          updatedAt: secondsToIso(getPath(item, ['updated_at'])) ?? new Date().toISOString()
        })
      )
    }
  }
}
