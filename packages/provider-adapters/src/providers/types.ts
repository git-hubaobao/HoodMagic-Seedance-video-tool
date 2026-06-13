import type {
  VideoGenerationRequest,
  VideoProviderConfig,
  VideoProviderType,
  VideoTask,
  VideoTaskListFilter
} from '@hoodmagic/video-core'

export type VideoProviderAdapter = {
  type: VideoProviderType | 'mock'
  createTask: (request: VideoGenerationRequest, config: VideoProviderConfig) => Promise<VideoTask>
  getTask: (taskId: string, config: VideoProviderConfig, previousTask?: VideoTask) => Promise<VideoTask>
  cancelTask: (taskId: string, config: VideoProviderConfig, previousTask?: VideoTask) => Promise<VideoTask | undefined>
  listTasks?: (config: VideoProviderConfig, filter?: VideoTaskListFilter) => Promise<VideoTask[]>
}
