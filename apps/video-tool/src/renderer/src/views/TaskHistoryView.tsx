import { Copy, Download, RefreshCw, Trash2, XCircle } from 'lucide-react'
import type { JSX } from 'react'

import type { VideoTask } from '@hoodmagic/video-core'
import { canCancelVideoTask } from '@hoodmagic/video-core'

import { StatusBadge } from '../components/StatusBadge'

type TaskHistoryViewProps = {
  tasks: VideoTask[]
  onRefreshTasks: () => Promise<void>
  onCopy: (value: string, label?: string) => Promise<void>
  onDownloadTask: (taskId: string) => Promise<void>
  onCancelTask: (taskId: string) => Promise<void>
  onDeleteTask: (taskId: string) => Promise<void>
  onError: (message: string) => void
}

const formatDate = (value: string): string => new Date(value).toLocaleString()

const providerLabel = (provider: string): string => {
  if (provider === 'hoodmagic') {
    return '自定义服务商'
  }

  if (provider === 'volcengine') {
    return '火山引擎官方'
  }

  return provider
}

export function TaskHistoryView({
  tasks,
  onRefreshTasks,
  onCopy,
  onDownloadTask,
  onCancelTask,
  onDeleteTask,
  onError
}: TaskHistoryViewProps): JSX.Element {
  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action()
    } catch (error) {
      onError(error instanceof Error ? error.message : '操作失败。')
    }
  }

  return (
    <section className="panel page-panel">
      <div className="panel-heading">
        <h2>任务列表</h2>
        <button className="icon-button" onClick={() => void onRefreshTasks()} title="刷新任务" type="button">
          <RefreshCw size={15} />
        </button>
      </div>
      {tasks.length === 0 ? (
        <div className="empty-card">暂无任务。</div>
      ) : (
        <div className="task-table">
          <div className="task-table-head">
            <span>状态</span>
            <span>模型</span>
            <span>时间</span>
            <span>结果 / 错误</span>
            <span>操作</span>
          </div>
          {tasks.map((task) => (
            <div className="task-table-row" key={task.id}>
              <div>
                <StatusBadge status={task.status} />
              </div>
              <div>
                <strong>{task.model}</strong>
                <small>{providerLabel(task.provider)}</small>
              </div>
              <div>
                <span>{formatDate(task.createdAt)}</span>
                {task.completedAt ? <small>完成 {formatDate(task.completedAt)}</small> : null}
              </div>
              <div className="result-cell">
                {task.videoUrl ? (
                  <button
                    className="link-button task-result-link"
                    onClick={() => void run(() => onCopy(task.videoUrl ?? '', '视频链接已复制。'))}
                    type="button"
                  >
                    视频链接可用，点击复制
                  </button>
                ) : (
                  <span>{task.error?.message ?? task.progress ?? '等待中'}</span>
                )}
                {task.usage ? (
                  <small>
                    用量：总 {task.usage.totalTokens ?? '-'} / 输出 {task.usage.completionTokens ?? '-'}
                  </small>
                ) : null}
              </div>
              <div className="row-actions">
                <button
                  className="icon-button"
                  disabled={!task.videoUrl}
                  onClick={() => void run(() => onCopy(task.videoUrl ?? '', '视频链接已复制。'))}
                  title="复制视频链接"
                  type="button"
                >
                  <Copy size={14} />
                </button>
                <button
                  className="icon-button"
                  disabled={!task.videoUrl}
                  onClick={() => void run(() => onDownloadTask(task.id))}
                  title="下载视频"
                  type="button"
                >
                  <Download size={14} />
                </button>
                <button
                  className="icon-button"
                  disabled={!canCancelVideoTask(task)}
                  onClick={() => void run(() => onCancelTask(task.id))}
                  title="取消任务"
                  type="button"
                >
                  <XCircle size={14} />
                </button>
                <button
                  className="icon-button danger-icon"
                  onClick={() => void run(() => onDeleteTask(task.id))}
                  title="删除本地记录"
                  type="button"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
