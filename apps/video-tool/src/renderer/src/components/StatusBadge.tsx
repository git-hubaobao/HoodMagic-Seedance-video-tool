import type { VideoTaskStatus } from '@hoodmagic/video-core'
import type { JSX } from 'react'

const labels: Record<VideoTaskStatus, string> = {
  queued: '排队中',
  running: '生成中',
  succeeded: '成功',
  failed: '失败',
  cancelled: '已取消',
  expired: '已过期',
  unknown: '未知'
}

export function StatusBadge({ status }: { status: VideoTaskStatus }): JSX.Element {
  return <span className={`status-badge status-${status}`}>{labels[status]}</span>
}
