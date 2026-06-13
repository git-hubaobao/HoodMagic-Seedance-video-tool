import { resolveVideoModelConfig } from './models'
import type {
  VideoContentItem,
  VideoGenerationRequest,
  VideoModelConfig,
  VideoRatio,
  VideoResolution
} from './shared/types/videoGeneration'

export type VideoValidationIssue = {
  code: string
  message: string
}

export type VideoValidationResult =
  | {
      ok: true
    }
  | {
      ok: false
      issues: VideoValidationIssue[]
    }

const allowedResolutions = new Set<VideoResolution>(['480p', '720p', '1080p'])
const allowedRatios = new Set<VideoRatio>(['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9'])

export const getContentText = (content: readonly VideoContentItem[]): string => {
  return content
    .filter((item): item is Extract<VideoContentItem, { type: 'text' }> => item.type === 'text')
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join('\n')
}

const isNonEmptyUrl = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

export const validateVideoGenerationRequest = (
  request: VideoGenerationRequest,
  modelConfig: VideoModelConfig = resolveVideoModelConfig(request.model)
): VideoValidationResult => {
  const issues: VideoValidationIssue[] = []
  const contentText = getContentText(request.content)
  const images = request.content.filter((item) => item.type === 'image_url')
  const videos = request.content.filter((item) => item.type === 'video_url')
  const audios = request.content.filter((item) => item.type === 'audio_url')
  const firstFrameImages = images.filter((item) => item.role === 'first_frame' || !item.role)
  const lastFrameImages = images.filter((item) => item.role === 'last_frame')
  const referenceImages = images.filter((item) => item.role === 'reference_image')

  if (!contentText) {
    issues.push({
      code: 'prompt_required',
      message: 'Prompt/content text is required.'
    })
  }

  if (!allowedResolutions.has(request.resolution)) {
    issues.push({
      code: 'invalid_resolution',
      message: 'Resolution must be 480p, 720p, or 1080p.'
    })
  }

  if (request.resolution === '1080p' && !modelConfig.supports1080p) {
    issues.push({
      code: 'resolution_not_supported',
      message: 'Seedance 2.0 fast does not support 1080p.'
    })
  }

  if (!allowedRatios.has(request.ratio)) {
    issues.push({
      code: 'invalid_ratio',
      message: 'Ratio must be adaptive, 16:9, 9:16, 1:1, 4:3, 3:4, or 21:9.'
    })
  }

  const isSmartDuration = request.duration === -1
  if (!Number.isInteger(request.duration)) {
    issues.push({
      code: 'invalid_duration',
      message: 'Duration must be an integer.'
    })
  } else if (isSmartDuration && !modelConfig.allowSmartDuration) {
    issues.push({
      code: 'smart_duration_not_supported',
      message: 'This model does not support smart duration -1.'
    })
  } else if (!isSmartDuration && (request.duration < modelConfig.durationMin || request.duration > modelConfig.durationMax)) {
    issues.push({
      code: 'duration_out_of_range',
      message: `Duration must be ${modelConfig.durationMin}-${modelConfig.durationMax} seconds, or -1 when supported.`
    })
  }

  if (request.seed !== undefined) {
    if (!Number.isInteger(request.seed) || request.seed < -1 || request.seed > 2 ** 32 - 1) {
      issues.push({
        code: 'invalid_seed',
        message: 'Seed must be an integer from -1 to 2^32-1.'
      })
    }
  }

  if (request.tools?.some((tool) => tool.type === 'web_search') && !modelConfig.supportsWebSearch) {
    issues.push({
      code: 'tools_not_supported',
      message: 'Web search tools are only supported by Seedance 2.0 models.'
    })
  }

  for (const item of images) {
    if (!isNonEmptyUrl(item.image_url.url)) {
      issues.push({ code: 'image_url_required', message: 'Image URL is required.' })
    }
  }

  for (const item of videos) {
    if (!isNonEmptyUrl(item.video_url.url)) {
      issues.push({ code: 'video_url_required', message: 'Video URL is required.' })
    }
  }

  for (const item of audios) {
    if (!isNonEmptyUrl(item.audio_url.url)) {
      issues.push({ code: 'audio_url_required', message: 'Audio URL is required.' })
    }
  }

  const hasFirstOrLastRole = images.some((item) => item.role === 'first_frame' || item.role === 'last_frame' || !item.role)
  const hasReferenceRole = referenceImages.length > 0 || videos.length > 0 || audios.length > 0

  if (hasFirstOrLastRole && hasReferenceRole && request.mode !== 'text_only') {
    issues.push({
      code: 'mixed_generation_modes',
      message: 'First-frame, first/last-frame, and reference modes cannot be mixed.'
    })
  }

  if (request.mode === 'text_only') {
    if (images.length > 0 || videos.length > 0 || audios.length > 0) {
      issues.push({
        code: 'text_only_has_media',
        message: 'Text-only mode cannot include media references.'
      })
    }
  }

  if (request.mode === 'first_frame') {
    if (images.length !== 1 || firstFrameImages.length !== 1 || lastFrameImages.length > 0 || videos.length > 0 || audios.length > 0) {
      issues.push({
        code: 'invalid_first_frame_mode',
        message: 'First-frame mode requires exactly one image with role first_frame.'
      })
    }
  }

  if (request.mode === 'first_last_frame') {
    if (
      images.length !== 2 ||
      firstFrameImages.length !== 1 ||
      lastFrameImages.length !== 1 ||
      referenceImages.length > 0 ||
      videos.length > 0 ||
      audios.length > 0
    ) {
      issues.push({
        code: 'invalid_first_last_frame_mode',
        message: 'First/last-frame mode requires two images with first_frame and last_frame roles.'
      })
    }
  }

  if (request.mode === 'reference') {
    if (firstFrameImages.length > 0 || lastFrameImages.length > 0) {
      issues.push({
        code: 'reference_mode_has_frame_roles',
        message: 'Reference mode cannot use first_frame or last_frame roles.'
      })
    }

    if (referenceImages.length > 9) {
      issues.push({
        code: 'too_many_reference_images',
        message: 'Reference-image mode supports 1-9 images.'
      })
    }

    if (videos.length > 3) {
      issues.push({
        code: 'too_many_reference_videos',
        message: 'Seedance 2.0 supports at most three reference videos.'
      })
    }

    if (audios.length > 3) {
      issues.push({
        code: 'too_many_reference_audios',
        message: 'Seedance 2.0 supports at most three reference audio files.'
      })
    }

    if (referenceImages.length + videos.length === 0) {
      issues.push({
        code: 'reference_media_required',
        message: 'Reference mode requires at least one reference image or reference video.'
      })
    }

    if (audios.length > 0 && referenceImages.length + videos.length === 0) {
      issues.push({
        code: 'audio_requires_visual_reference',
        message: 'Reference audio cannot be used alone; add at least one image or video.'
      })
    }
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

export const validateAssetSourceUrl = (url: string): VideoValidationResult => {
  const trimmed = url.trim()
  let parsedUrl: URL
  try {
    parsedUrl = new URL(trimmed)
  } catch {
    return {
      ok: false,
      issues: [
        {
          code: 'asset_url_must_be_public',
          message: 'Asset upload currently requires a public http(s) URL; local files need object storage first.'
        }
      ]
    }
  }

  const host = parsedUrl.hostname.toLowerCase()
  const privateIp =
    /^10\./.test(host) ||
    /^127\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)

  if ((parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') || host === 'localhost' || privateIp) {
    return {
      ok: false,
      issues: [
        {
          code: 'asset_url_must_be_public',
          message: 'Asset upload currently requires a public http(s) URL; local files need object storage first.'
        }
      ]
    }
  }

  return { ok: true }
}
