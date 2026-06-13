import type { AssetType } from './assets'

export type VideoProviderType = 'hoodmagic' | 'volcengine'

export type InternalVideoProviderType = VideoProviderType | 'mock'

export type VideoGenerationMode = 'text_only' | 'first_frame' | 'first_last_frame' | 'reference'

export type VideoResolution = '480p' | '720p' | '1080p'

export type VideoRatio = 'adaptive' | '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9'

export type VideoContentRole = 'first_frame' | 'last_frame' | 'reference_image' | 'reference_video' | 'reference_audio'

export type VideoTool = {
  type: 'web_search'
}

export type VideoTextContentItem = {
  type: 'text'
  text: string
}

export type VideoImageContentItem = {
  type: 'image_url'
  image_url: {
    url: string
  }
  role?: Extract<VideoContentRole, 'first_frame' | 'last_frame' | 'reference_image'>
  assetType?: Extract<AssetType, 'Image'>
  name?: string
}

export type VideoReferenceContentItem = {
  type: 'video_url'
  video_url: {
    url: string
  }
  role: 'reference_video'
  assetType?: Extract<AssetType, 'Video'>
  name?: string
}

export type AudioReferenceContentItem = {
  type: 'audio_url'
  audio_url: {
    url: string
  }
  role: 'reference_audio'
  assetType?: Extract<AssetType, 'Audio'>
  name?: string
}

export type VideoContentItem =
  | VideoTextContentItem
  | VideoImageContentItem
  | VideoReferenceContentItem
  | AudioReferenceContentItem

export type VideoTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'unknown'

export type VideoTaskUsage = {
  totalTokens?: number
  completionTokens?: number
  toolUsage?: {
    webSearch?: number
  }
}

export type VideoTaskError = {
  code?: string
  message: string
  type?: string
}

export type ProviderResponseMapping = {
  providerTaskIdField: 'task_id' | 'id'
  requestContentLocation: 'metadata.content' | 'content'
  resultVideoUrlPath: 'data.data.content.video_url' | 'content.video_url'
  statusFamily: 'hoodmagic' | 'volcengine'
}

export type VideoModelProviderScope = VideoProviderType | 'both'

export type VideoModelConfig = {
  id: string
  label?: string
  provider: VideoModelProviderScope
  supports1080p: boolean
  supportsWebSearch: boolean
  supportsReturnLastFrame: boolean
  durationMin: number
  durationMax: number
  allowSmartDuration: boolean
}

export type VideoProviderConfig = {
  provider: VideoProviderType
  baseUrl: string
  apiKey: string
  defaultModel: string
  defaultResolution: VideoResolution
  defaultRatio: VideoRatio
  defaultDuration: number
  generateAudio: boolean
  enableWebSearch: boolean
  downloadDirectory?: string
  models: VideoModelConfig[]
}

export type VideoGenerationRequest = {
  provider: VideoProviderType
  conversationId?: string
  model: string
  prompt: string
  mode: VideoGenerationMode
  content: VideoContentItem[]
  resolution: VideoResolution
  ratio: VideoRatio
  duration: number
  generateAudio: boolean
  seed?: number
  watermark?: boolean
  returnLastFrame?: boolean
  tools?: VideoTool[]
  callbackUrl?: string
}

export type VideoTask = {
  id: string
  conversationId?: string
  provider: VideoProviderType
  providerTaskId?: string
  status: VideoTaskStatus
  rawStatus?: string
  model: string
  prompt?: string
  mode?: VideoGenerationMode
  request?: VideoGenerationRequest
  progress?: string
  videoUrl?: string
  lastFrameUrl?: string
  usage?: VideoTaskUsage
  error?: VideoTaskError
  createdAt: string
  updatedAt: string
  completedAt?: string
  localFilePath?: string
  localFileUrl?: string
  raw?: unknown
}

export type VideoTaskEvent = {
  type: 'created' | 'updated' | 'deleted'
  task: VideoTask
}

export type VideoTaskEventCallback = (event: VideoTaskEvent) => void

export type VideoTaskListFilter = {
  status?: VideoTaskStatus
  model?: string
  taskIds?: string[]
  pageNumber?: number
  pageSize?: number
}
