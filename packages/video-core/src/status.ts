import type { VideoProviderType, VideoTask, VideoTaskStatus } from './shared/types/videoGeneration'

const statusMap: Record<string, VideoTaskStatus> = {
  not_start: 'queued',
  notstart: 'queued',
  queued: 'queued',
  pending: 'queued',
  submitted: 'queued',
  in_progress: 'running',
  progress: 'running',
  running: 'running',
  processing: 'running',
  success: 'succeeded',
  succeeded: 'succeeded',
  failure: 'failed',
  failed: 'failed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  expired: 'expired',
  timeout: 'expired'
}

export const normalizeVideoTaskStatus = (status: unknown): VideoTaskStatus => {
  if (typeof status !== 'string') {
    return 'unknown'
  }

  return statusMap[status.trim().toLowerCase()] ?? 'unknown'
}

export const isTerminalVideoTaskStatus = (status: VideoTaskStatus): boolean => {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'expired'
}

export const canCancelVideoTask = (task: Pick<VideoTask, 'provider' | 'status'>): boolean => {
  if (task.provider === 'volcengine') {
    return task.status === 'queued'
  }

  return task.status === 'queued' || task.status === 'running'
}

export const providerStatusLabels: Record<VideoProviderType, string> = {
  hoodmagic: 'HoodMagic',
  volcengine: 'Volcengine'
}
