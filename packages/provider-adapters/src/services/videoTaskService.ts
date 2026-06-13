import {
  resolveVideoModelConfig,
  validateVideoGenerationRequest,
  type VideoGenerationRequest,
  type VideoProviderConfig,
  type VideoTask
} from '@hoodmagic/video-core'

import type { VideoProviderAdapter } from '../providers/types'

export class VideoTaskService {
  constructor(private readonly provider: VideoProviderAdapter) {}

  async createTask(request: VideoGenerationRequest, config: VideoProviderConfig): Promise<VideoTask> {
    const validation = validateVideoGenerationRequest(request, resolveVideoModelConfig(request.model, config.models))
    if (!validation.ok) {
      throw new Error(validation.issues.map((issue) => issue.message).join('\n'))
    }

    return this.provider.createTask(request, config)
  }

  async refreshTask(task: VideoTask, config: VideoProviderConfig): Promise<VideoTask> {
    return this.provider.getTask(task.providerTaskId ?? task.id, config, task)
  }

  async cancelTask(task: VideoTask, config: VideoProviderConfig): Promise<VideoTask | undefined> {
    return this.provider.cancelTask(task.providerTaskId ?? task.id, config, task)
  }
}
