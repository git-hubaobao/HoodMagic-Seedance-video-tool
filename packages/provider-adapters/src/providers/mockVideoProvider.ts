import type { VideoGenerationRequest, VideoProviderConfig, VideoTask } from '@hoodmagic/video-core'

import type { VideoProviderAdapter } from './types'

type MockRecord = VideoTask & {
  pollCount: number
}

export const createMockVideoProvider = (): VideoProviderAdapter => {
  const tasks = new Map<string, MockRecord>()

  return {
    type: 'mock',
    async createTask(request: VideoGenerationRequest, _config: VideoProviderConfig): Promise<VideoTask> {
      const now = new Date().toISOString()
      const id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const task: MockRecord = {
        id,
        provider: request.provider,
        providerTaskId: id,
        status: 'queued',
        rawStatus: 'queued',
        model: request.model,
        prompt: request.prompt,
        mode: request.mode,
        request,
        createdAt: now,
        updatedAt: now,
        pollCount: 0,
        raw: { id, status: 'queued' }
      }
      tasks.set(id, task)
      return { ...task }
    },
    async getTask(taskId: string, _config: VideoProviderConfig): Promise<VideoTask> {
      const existing = tasks.get(taskId)
      if (!existing) {
        const now = new Date().toISOString()
        return {
          id: taskId,
          provider: 'hoodmagic',
          status: 'failed',
          rawStatus: 'failed',
          model: 'mock-model',
          createdAt: now,
          updatedAt: now,
          error: { code: 'mock_not_found', message: 'Mock task not found.' }
        }
      }

      existing.pollCount += 1
      existing.updatedAt = new Date().toISOString()

      if (existing.pollCount === 1) {
        existing.status = 'running'
        existing.rawStatus = 'running'
        existing.progress = '45%'
      } else {
        existing.status = 'succeeded'
        existing.rawStatus = 'succeeded'
        existing.progress = '100%'
        existing.videoUrl = 'https://example.com/mock-seedance-result.mp4'
        existing.usage = { totalTokens: 1200, completionTokens: 1200 }
        existing.completedAt = existing.updatedAt
      }

      tasks.set(taskId, existing)
      return { ...existing }
    },
    async cancelTask(taskId: string): Promise<VideoTask | undefined> {
      const existing = tasks.get(taskId)
      if (!existing) {
        return undefined
      }

      const now = new Date().toISOString()
      const next = {
        ...existing,
        status: 'cancelled' as const,
        rawStatus: 'cancelled',
        updatedAt: now,
        completedAt: now
      }
      tasks.set(taskId, next)
      return { ...next }
    }
  }
}
