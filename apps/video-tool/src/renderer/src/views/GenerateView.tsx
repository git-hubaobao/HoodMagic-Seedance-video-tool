import {
  Copy,
  Download,
  ImagePlus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  UploadCloud,
  X
} from 'lucide-react'
import type { ClipboardEvent, DragEvent, JSX, KeyboardEvent } from 'react'
import { useMemo, useRef, useState } from 'react'

import type {
  AssetGroup,
  AssetItem,
  AssetType,
  VideoContentItem,
  VideoContentRole,
  VideoGenerationRequest,
  VideoRatio,
  VideoResolution,
  VideoTask
} from '@hoodmagic/video-core'
import { canCancelVideoTask, getVideoModelsForProvider } from '@hoodmagic/video-core'
import type { InterfaceLanguage, VideoToolSettings } from '@hoodmagic/storage'

import type { VideoToolApi } from '../../../shared/video'
import { SelectMenu } from '../components/SelectMenu'
import { StatusBadge } from '../components/StatusBadge'

type SelectedMedia = {
  id: string
  name: string
  url: string
  previewUrl?: string
  type: AssetType
  role: VideoContentRole
}

type GenerateViewProps = {
  api: VideoToolApi
  settings: VideoToolSettings
  conversationId?: string
  language: InterfaceLanguage
  tasks: VideoTask[]
  assets: AssetItem[]
  groups: AssetGroup[]
  onRefreshTasks: () => Promise<void>
  onRefreshAssets: () => Promise<void>
  onToast: (message: string) => void
  onError: (message: string) => void
  onCopy: (value: string, label?: string) => Promise<void>
  onDownloadTask: (taskId: string) => Promise<void>
  onCancelTask: (taskId: string) => Promise<void>
}

type GenerateCopy = {
  guidance: string
  uploadHint: string
  typeLabel: Record<AssetType, string>
  roleLabel: Record<VideoContentRole, string>
  library: string
  emptyLibrary: string
  searchAssets: string
  allTypes: string
  allStatuses: string
  pasteUpload: string
  dropUpload: string
  uploading: string
  uploadDone: string
  noGroup: string
  audio: string
  watermark: string
  advanced: string
  seedPlaceholder: string
  lastFrame: string
  webSearch: string
  submit: string
  addOk: (count: number) => string
  activeOnly: string
  importFailed: string
  submitted: string
  submitFailed: string
  noTasks: string
  taskSucceeded: string
  taskSubmitted: string
  copyLink: string
  copiedLink: string
  download: string
  cancel: string
  shortLinkNotice: string
  taskPending: string
}

const generateCopy: Record<InterfaceLanguage, GenerateCopy> = {
  zh: {
    guidance: '输入画面描述，可添加素材库中已可用的图片、视频或音频作为参考。',
    uploadHint: '+ 参考内容',
    typeLabel: {
      Image: '图片',
      Video: '视频',
      Audio: '音频'
    },
    roleLabel: {
      first_frame: '首帧',
      last_frame: '尾帧',
      reference_image: '参考图',
      reference_video: '参考视频',
      reference_audio: '参考音频'
    },
    library: '素材库',
    emptyLibrary: '素材库暂无可用素材，请到素材库用公网 URL 上传并等待状态变为可用。',
    searchAssets: '搜索素材名称或 asset://',
    allTypes: '全部类型',
    allStatuses: '全部状态',
    pasteUpload: '已检测到粘贴素材，正在上传到素材库...',
    dropUpload: '释放以上传素材到 Seedance 素材库',
    uploading: '素材上传中...',
    uploadDone: '素材已上传并插入。',
    noGroup: '请先在素材库创建一个素材分组，再使用粘贴或拖拽上传。',
    audio: '音频',
    watermark: '水印',
    advanced: '高级参数',
    seedPlaceholder: '-1 或整数',
    lastFrame: '返回尾帧',
    webSearch: '联网搜索',
    submit: '生成',
    addOk: (count) => `已添加 ${count} 个参考素材。`,
    activeOnly: '只有可用状态的素材可以用于生成。',
    importFailed: '素材库打开失败。',
    submitted: '任务已提交。',
    submitFailed: '任务提交失败。',
    noTasks: '还没有生成记录。',
    taskSucceeded: '视频生成成功',
    taskSubmitted: '任务已提交',
    copyLink: '复制链接',
    copiedLink: '视频链接已复制。',
    download: '下载',
    cancel: '取消',
    shortLinkNotice: '官方视频链接有效期较短，请及时下载或转存。',
    taskPending: '排队或生成中...'
  },
  en: {
    guidance: 'Describe the scene and add Active assets from the asset library as references.',
    uploadHint: '+ Reference',
    typeLabel: {
      Image: 'Image',
      Video: 'Video',
      Audio: 'Audio'
    },
    roleLabel: {
      first_frame: 'First',
      last_frame: 'Last',
      reference_image: 'Image ref',
      reference_video: 'Video ref',
      reference_audio: 'Audio ref'
    },
    library: 'Library',
    emptyLibrary: 'No Active assets yet. Upload a public URL in the asset library and wait for Active.',
    searchAssets: 'Search name or asset://',
    allTypes: 'All types',
    allStatuses: 'All statuses',
    pasteUpload: 'Pasted asset detected. Uploading to the asset library...',
    dropUpload: 'Drop to upload to the Seedance asset library',
    uploading: 'Uploading asset...',
    uploadDone: 'Asset uploaded and inserted.',
    noGroup: 'Create an asset group first, then use paste or drag upload.',
    audio: 'Audio',
    watermark: 'Watermark',
    advanced: 'Advanced',
    seedPlaceholder: '-1 or integer',
    lastFrame: 'return_last_frame',
    webSearch: 'web_search',
    submit: 'Generate',
    addOk: (count) => `Added ${count} reference asset(s).`,
    activeOnly: 'Only Active assets can be used for generation.',
    importFailed: 'Asset library failed to open.',
    submitted: 'Task submitted.',
    submitFailed: 'Task submission failed.',
    noTasks: 'No generation history yet.',
    taskSucceeded: 'Video generated',
    taskSubmitted: 'Task submitted',
    copyLink: 'Copy link',
    copiedLink: 'Video link copied.',
    download: 'Download',
    cancel: 'Cancel',
    shortLinkNotice: 'Official video links expire quickly. Download or transfer them soon.',
    taskPending: 'Queued or generating...'
  }
}

const resolutions: VideoResolution[] = ['480p', '720p', '1080p']
const ratios: VideoRatio[] = ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
const durations = [4, 5, 6, 7, 8, 9, 10, 12, 15]

const getDefaultRole = (assetType: AssetType): VideoContentRole => {
  if (assetType === 'Video') {
    return 'reference_video'
  }

  if (assetType === 'Audio') {
    return 'reference_audio'
  }

  return 'reference_image'
}

const toContentItem = (media: SelectedMedia): VideoContentItem => {
  if (media.type === 'Image') {
    return {
      type: 'image_url',
      image_url: { url: media.url },
      role: media.role === 'reference_video' || media.role === 'reference_audio' ? 'reference_image' : media.role,
      name: media.name
    }
  }

  if (media.type === 'Video') {
    return {
      type: 'video_url',
      video_url: { url: media.url },
      role: 'reference_video',
      name: media.name
    }
  }

  return {
    type: 'audio_url',
    audio_url: { url: media.url },
    role: 'reference_audio',
    name: media.name
  }
}

const toSelectedMedia = (asset: AssetItem): SelectedMedia => ({
  id: asset.id,
  name: asset.name,
  url: asset.assetUrl,
  type: asset.assetType,
  role: getDefaultRole(asset.assetType),
  ...(asset.url ? { previewUrl: asset.url } : {})
})

const getTaskVideoSrc = (task: VideoTask): string | undefined => task.localFileUrl ?? task.videoUrl

const getAssetTypeFromFile = (file: File): AssetType | undefined => {
  if (file.type.startsWith('image/')) {
    return 'Image'
  }

  if (file.type.startsWith('video/')) {
    return 'Video'
  }

  if (file.type.startsWith('audio/')) {
    return 'Audio'
  }

  const name = file.name.toLowerCase()
  if (/\.(jpe?g|png|webp|bmp|gif|tiff?)$/.test(name)) {
    return 'Image'
  }

  if (/\.(mp4|mov)$/.test(name)) {
    return 'Video'
  }

  if (/\.(mp3|wav)$/.test(name)) {
    return 'Audio'
  }

  return undefined
}

export function GenerateView({
  api,
  settings,
  conversationId,
  language,
  tasks,
  assets,
  groups,
  onRefreshTasks,
  onRefreshAssets,
  onToast,
  onError,
  onCopy,
  onDownloadTask,
  onCancelTask
}: GenerateViewProps): JSX.Element {
  const text = generateCopy[language]
  const activeConfig = settings.providers[settings.activeProvider]
  const models = getVideoModelsForProvider(activeConfig.models, settings.activeProvider)
  const composerRef = useRef<HTMLDivElement | null>(null)
  const localAssetInputRef = useRef<HTMLInputElement | null>(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState(activeConfig.defaultModel)
  const [resolution, setResolution] = useState<VideoResolution>(activeConfig.defaultResolution)
  const [ratio, setRatio] = useState<VideoRatio>(activeConfig.defaultRatio)
  const [duration, setDuration] = useState(String(activeConfig.defaultDuration))
  const [generateAudio, setGenerateAudio] = useState(activeConfig.generateAudio)
  const [useWebSearch, setUseWebSearch] = useState(activeConfig.enableWebSearch)
  const [seed, setSeed] = useState('')
  const [watermark, setWatermark] = useState(false)
  const [returnLastFrame, setReturnLastFrame] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionTab, setMentionTab] = useState<'library' | 'local'>('library')
  const [assetSearch, setAssetSearch] = useState('')
  const [uploadingLocal, setUploadingLocal] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const uploadableGroupId = useMemo(() => groups.find((group) => group.id > 0)?.id, [groups])
  const referenceAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase()
    return assets
      .filter((asset) => asset.status === 'Active')
      .filter((asset) => {
        if (!search) {
          return true
        }

        return asset.name.toLowerCase().includes(search) || asset.assetUrl.toLowerCase().includes(search)
      })
      .slice(0, 80)
  }, [assetSearch, assets])
  const visibleTasks = useMemo(() => [...tasks].slice(0, 20).reverse(), [tasks])
  const canSubmit = prompt.trim().length > 0 && !submitting

  const addAssets = (incomingAssets: AssetItem[]): void => {
    setPrompt((value) => (value.endsWith('@') ? value.slice(0, -1).trimEnd() : value))
    setSelectedMedia((items) => {
      const existingUrls = new Set(items.map((item) => item.url))
      const additions = incomingAssets
        .filter((asset) => asset.status === 'Active' && !existingUrls.has(asset.assetUrl))
        .map((asset) => toSelectedMedia(asset))

      return [...items, ...additions]
    })
  }

  const openAssetLibrary = async (): Promise<void> => {
    try {
      await onRefreshAssets()
      setMentionTab('library')
      setAssetSearch('')
      setMentionOpen((value) => !value)
    } catch (error) {
      onError(error instanceof Error ? error.message : text.importFailed)
    }
  }

  const uploadFilesToAssetLibrary = async (files: File[]): Promise<void> => {
    const uploadableFiles = files.slice(0, 9)
    if (uploadableFiles.length === 0) {
      return
    }

    if (!uploadableGroupId) {
      onError(text.noGroup)
      return
    }

    setUploadingLocal(true)
    onToast(text.pasteUpload)
    try {
      const uploadedAssets: AssetItem[] = []
      for (const file of uploadableFiles) {
        const assetType = getAssetTypeFromFile(file)
        if (!assetType) {
          onError(`不支持的素材类型：${file.name || file.type || 'unknown'}`)
          continue
        }

        const bytes = await file.arrayBuffer()
        const result = await api.uploadLocalAssetFile({
          groupId: uploadableGroupId,
          assetType,
          name: file.name || `clipboard-${Date.now()}`,
          fileName: file.name || `clipboard-${Date.now()}.${assetType === 'Image' ? 'png' : 'bin'}`,
          mimeType: file.type || 'application/octet-stream',
          bytes
        })

        if (result.errorMessage) {
          onError(result.errorMessage)
        }

        if (result.asset) {
          uploadedAssets.push(result.asset)
        }
      }

      await onRefreshAssets()
      const activeUploadedAssets = uploadedAssets.filter((asset) => asset.status === 'Active')
      if (activeUploadedAssets.length > 0) {
        addAssets(activeUploadedAssets)
        setMentionOpen(false)
      }
      onToast(activeUploadedAssets.length > 0 ? text.uploadDone : text.uploading)
    } catch (error) {
      onError(error instanceof Error ? error.message : '本地素材上传失败。')
    } finally {
      setUploadingLocal(false)
    }
  }

  const addAsset = (asset: AssetItem): void => {
    if (asset.status !== 'Active') {
      onError(text.activeOnly)
      return
    }

    addAssets([asset])
    setMentionOpen(false)
  }

  const updateRole = (id: string, role: VideoContentRole): void => {
    setSelectedMedia((items) => items.map((item) => (item.id === id ? { ...item, role } : item)))
  }

  const removeMedia = (id: string): void => {
    setSelectedMedia((items) => items.filter((item) => item.id !== id))
  }

  const submit = async (): Promise<void> => {
    const localReference = selectedMedia.find(
      (item) => /^asset:\/\/local-/i.test(item.url) || item.url.startsWith('file://') || /^[a-z]:\\/i.test(item.url)
    )
    if (localReference) {
      onError('本地文件不能直接用于生成，请先通过素材库 API 获取 asset:// 地址。')
      return
    }

    const durationValue = Number(duration)
    const seedValue = seed.trim() ? Number(seed) : undefined
    const request: VideoGenerationRequest = {
      provider: settings.activeProvider,
      ...(conversationId ? { conversationId } : {}),
      model,
      prompt,
      mode: selectedMedia.length > 0 ? 'reference' : 'text_only',
      content: [{ type: 'text', text: prompt }, ...selectedMedia.map(toContentItem)],
      resolution,
      ratio,
      duration: durationValue,
      generateAudio,
      ...(seedValue !== undefined && Number.isInteger(seedValue) ? { seed: seedValue } : {}),
      watermark,
      returnLastFrame,
      ...(useWebSearch ? { tools: [{ type: 'web_search' }] } : {})
    }

    setSubmitting(true)
    try {
      await api.createVideoTask(request)
      setPrompt('')
      setSelectedMedia([])
      await onRefreshTasks()
      onToast(text.submitted)
    } catch (error) {
      onError(error instanceof Error ? error.message : text.submitFailed)
    } finally {
      setSubmitting(false)
    }
  }

  const handlePromptChange = (value: string): void => {
    setPrompt(value)
    if (value.endsWith('@')) {
      setMentionTab('library')
      setAssetSearch('')
      setMentionOpen(true)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const files = Array.from(event.clipboardData.files)
    const imageItems = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    const pastedFiles = files.length > 0 ? files : imageItems

    if (pastedFiles.length === 0) {
      return
    }

    event.preventDefault()
    void uploadFilesToAssetLibrary(pastedFiles)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragActive(false)
    const files = Array.from(event.dataTransfer.files)
    void uploadFilesToAssetLibrary(files)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape' && mentionOpen) {
      event.preventDefault()
      setMentionOpen(false)
      return
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      if (canSubmit) {
        void submit()
      }
    }
  }

  return (
    <div className="dream-generate-shell">
      <section className="dream-message-area">
        <section className="dream-results">
          {visibleTasks.length === 0 ? (
            <div className="empty-card">{text.noTasks}</div>
          ) : (
            <div className="dream-task-grid">
              {visibleTasks.slice(0, 12).map((task) => {
                const videoSrc = getTaskVideoSrc(task)
                const canCancel = canCancelVideoTask(task)
                return (
                  <article className="dream-task-card" key={task.id}>
                    <div className="task-message-top">
                      <strong>{task.status === 'succeeded' ? text.taskSucceeded : text.taskSubmitted}</strong>
                      <StatusBadge status={task.status} />
                    </div>
                    {videoSrc ? (
                      <video className="video-preview result-video-card" controls preload="metadata" src={videoSrc} />
                    ) : (
                      <div className="video-placeholder">{task.progress ?? text.taskPending}</div>
                    )}
                    {task.error ? <p className="error-line">{task.error.message}</p> : null}
                    <div className="task-actions">
                      <button
                        className="secondary-button"
                        disabled={!task.videoUrl}
                        onClick={() => task.videoUrl && void onCopy(task.videoUrl, text.copiedLink)}
                        type="button"
                      >
                        <Copy size={15} />
                        <span>{text.copyLink}</span>
                      </button>
                      <button
                        className="secondary-button"
                        disabled={!task.videoUrl}
                        onClick={() => void onDownloadTask(task.id)}
                        type="button"
                      >
                        <Download size={15} />
                        <span>{text.download}</span>
                      </button>
                      {canCancel ? (
                        <button className="secondary-button danger-button" onClick={() => void onCancelTask(task.id)} type="button">
                          {text.cancel}
                        </button>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </section>

      <section className="dream-composer-dock">
        <div
          className={dragActive ? 'dream-composer-card composer-drag-active' : 'dream-composer-card'}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => {
            event.preventDefault()
            setDragActive(true)
          }}
          onDrop={handleDrop}
          ref={composerRef}
        >
          {dragActive ? (
            <div className="composer-drop-layer">
              <UploadCloud size={24} />
              <strong>{text.dropUpload}</strong>
            </div>
          ) : null}
          {selectedMedia.length > 0 ? (
            <div className="dream-reference-list" aria-label={language === 'zh' ? '已选参考素材' : 'Selected reference assets'}>
              {selectedMedia.map((item) => (
                <div className="dream-reference-chip" key={item.id} title={item.name}>
                  {item.type === 'Image' && item.previewUrl ? (
                    <img alt={item.name} src={item.previewUrl} />
                  ) : item.type === 'Video' && item.previewUrl ? (
                    <video muted preload="metadata" src={item.previewUrl} />
                  ) : (
                    <span>{text.typeLabel[item.type]}</span>
                  )}
                  <SelectMenu
                    ariaLabel={language === 'zh' ? '参考素材角色' : 'Reference role'}
                    className="reference-role-select"
                    onChange={(value) => updateRole(item.id, value as VideoContentRole)}
                    options={[
                      ...(item.type === 'Image'
                        ? [
                            { value: 'first_frame', label: text.roleLabel.first_frame },
                            { value: 'last_frame', label: text.roleLabel.last_frame },
                            { value: 'reference_image', label: text.roleLabel.reference_image }
                          ]
                        : []),
                      ...(item.type === 'Video' ? [{ value: 'reference_video', label: text.roleLabel.reference_video }] : []),
                      ...(item.type === 'Audio' ? [{ value: 'reference_audio', label: text.roleLabel.reference_audio }] : [])
                    ]}
                    placement="top"
                    title={item.name}
                    value={item.role}
                  />
                  <button className="icon-button" onClick={() => removeMedia(item.id)} title="Remove" type="button">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="dream-prompt-row">
            <button className="dream-reference-tile" onClick={() => void openAssetLibrary()} type="button">
              <ImagePlus size={18} />
              <span>{text.uploadHint}</span>
            </button>
            <textarea
              onChange={(event) => handlePromptChange(event.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={text.guidance}
              value={prompt}
            />
          </div>

          <div className="dream-toolbar">
            <SelectMenu
              className="dream-select model-select"
              onChange={setModel}
              options={models.map((item) => ({ value: item.id, label: item.label ?? item.id }))}
              placement="top"
              value={model}
            />
            <SelectMenu
              className="dream-select ratio-select"
              onChange={(value) => setRatio(value as VideoRatio)}
              options={ratios.map((item) => ({ value: item, label: item }))}
              placement="top"
              value={ratio}
            />
            <SelectMenu
              className="dream-select duration-select"
              onChange={setDuration}
              options={durations.map((item) => ({ value: String(item), label: `${item}s` }))}
              placement="top"
              value={duration}
            />
            <SelectMenu
              className="dream-select resolution-select"
              onChange={(value) => setResolution(value as VideoResolution)}
              options={resolutions.map((item) => ({ value: item, label: item }))}
              placement="top"
              value={resolution}
            />
            <button aria-pressed={generateAudio} className="toggle-pill" onClick={() => setGenerateAudio((value) => !value)} type="button">
              {text.audio}
            </button>
            <button aria-pressed={watermark} className="toggle-pill" onClick={() => setWatermark((value) => !value)} type="button">
              {text.watermark}
            </button>
            <button className="icon-button" onClick={() => setShowAdvanced((value) => !value)} title={text.advanced} type="button">
              <Settings2 size={15} />
            </button>
            <button className="dream-send-button" disabled={!canSubmit} onClick={() => void submit()} title={text.submit} type="button">
              {submitting ? <RefreshCw size={18} /> : <Send size={18} />}
              <span>{text.submit}</span>
            </button>
          </div>

          {showAdvanced ? (
            <div className="advanced-strip">
              <label className="field">
                <span>{language === 'zh' ? '随机种子' : 'Seed'}</span>
                <input onChange={(event) => setSeed(event.target.value)} placeholder={text.seedPlaceholder} value={seed} />
              </label>
              <label>
                <input checked={returnLastFrame} onChange={(event) => setReturnLastFrame(event.target.checked)} type="checkbox" />
                <span>{text.lastFrame}</span>
              </label>
              <label>
                <input checked={useWebSearch} onChange={(event) => setUseWebSearch(event.target.checked)} type="checkbox" />
                <span>{text.webSearch}</span>
              </label>
            </div>
          ) : null}

        </div>
      </section>
      {mentionOpen ? (
        <div className="asset-reference-backdrop" onClick={() => setMentionOpen(false)} role="presentation">
          <section
            aria-label={language === 'zh' ? '引用素材' : 'Reference assets'}
            aria-modal="true"
            className="asset-reference-popover"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="asset-reference-header">
              <strong>{language === 'zh' ? '引用素材' : 'Reference assets'}</strong>
              <button className="icon-button" onClick={() => setMentionOpen(false)} title="Close" type="button">
                <X size={14} />
              </button>
            </header>
            <div className="asset-reference-tabs">
              <button aria-pressed={mentionTab === 'library'} onClick={() => setMentionTab('library')} type="button">
                {language === 'zh' ? '素材库素材' : 'Asset library'}
              </button>
              <button aria-pressed={mentionTab === 'local'} onClick={() => setMentionTab('local')} type="button">
                {language === 'zh' ? '本地素材' : 'Local files'}
              </button>
            </div>
            {mentionTab === 'library' ? (
              <>
                <div className="mention-search-box">
                  <Search size={14} />
                  <input
                    autoFocus
                    onChange={(event) => setAssetSearch(event.target.value)}
                    placeholder={text.searchAssets}
                    value={assetSearch}
                  />
                </div>
                <div className="asset-reference-grid">
                  {referenceAssets.length === 0 ? (
                    <div className="mention-empty">{text.emptyLibrary}</div>
                  ) : (
                    referenceAssets.map((asset) => (
                      <button
                        className="asset-reference-card"
                        key={asset.id}
                        onClick={() => addAsset(asset)}
                        title={asset.assetUrl}
                        type="button"
                      >
                        {asset.assetType === 'Image' && asset.url ? (
                          <img alt={asset.name} src={asset.url} />
                        ) : (
                          <span>{text.typeLabel[asset.assetType]}</span>
                        )}
                        <strong>{asset.name}</strong>
                        <small>{text.typeLabel[asset.assetType]}</small>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div
                className={uploadingLocal ? 'asset-reference-drop is-uploading' : 'asset-reference-drop'}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  void uploadFilesToAssetLibrary(Array.from(event.dataTransfer.files))
                }}
              >
                <UploadCloud size={22} />
                <strong>{uploadingLocal ? text.uploading : language === 'zh' ? '拖放文件上传并创建素材' : 'Drop files to upload and create assets'}</strong>
                <span>{language === 'zh' ? '会先上传到对象存储，再创建 Seedance 素材。' : 'Files are uploaded to object storage, then created as Seedance assets.'}</span>
                <button className="primary-button" onClick={() => localAssetInputRef.current?.click()} type="button">
                  {language === 'zh' ? '选择本地文件' : 'Choose local file'}
                </button>
                <input
                  hidden
                  multiple
                  onChange={(event) => {
                    void uploadFilesToAssetLibrary(Array.from(event.currentTarget.files ?? []))
                    event.currentTarget.value = ''
                  }}
                  ref={localAssetInputRef}
                  type="file"
                />
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
