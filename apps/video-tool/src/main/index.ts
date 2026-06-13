import { existsSync } from 'node:fs'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

import {
  AssetLibraryService,
  createHoodMagicVideoProvider,
  createVolcengineSeedanceProvider,
  extractLastFrameUrl,
  extractVideoUrl,
  VideoProviderError,
  VideoTaskService
} from '@hoodmagic/provider-adapters'
import {
  canCancelVideoTask,
  isTerminalVideoTaskStatus,
  type AssetGroup,
  type AssetItem,
  type AssetListRequest,
  type CreateAssetRequest,
  type LocalFileUploadRequest,
  type LocalFileUploadResult,
  type LocalAssetImportResult,
  type ObjectStorageConfig,
  type ObjectStorageTestResult,
  type VideoGenerationRequest,
  type VideoProviderConfig,
  type VideoTask,
  type VideoTaskEvent
} from '@hoodmagic/video-core'
import {
  createDefaultVideoToolData,
  createVideoConversation,
  createVideoProject,
  deleteVideoConversation,
  deleteVideoProject,
  getVideoSessionState,
  moveVideoConversation,
  removeVideoTask,
  redactObjectStorageConfig,
  renameVideoConversation,
  sanitizeObjectStorageConfig,
  sanitizeVideoToolData,
  sanitizeVideoToolSettings,
  setActiveVideoConversation,
  updateAssetCache,
  upsertVideoTask,
  type VideoToolData,
  type VideoSessionState,
  type VideoToolSettings
} from '@hoodmagic/storage'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import {
  getTemporaryCredentials,
  ObjectStorageService
} from './services/objectStorage/objectStorageService'

const WINDOW_TITLE = 'HoodMagic-SD-视频生成'
const POLL_INTERVAL_MS = 15_000
const ASSET_STATUS_POLL_INTERVAL_MS = 3_000
const ASSET_STATUS_POLL_ATTEMPTS = 20
const assetService = new AssetLibraryService()
const objectStorageService = new ObjectStorageService()

let pollTimer: NodeJS.Timeout | undefined
const previewCacheInFlight = new Set<string>()

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.gif'])
const videoExtensions = new Set(['.mp4', '.mov'])
const audioExtensions = new Set(['.wav', '.mp3'])
const mimeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.tif': 'image/tiff',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg'
}

const getWindowIconPath = (): string | undefined => {
  const candidatePaths = app.isPackaged
    ? [join(process.resourcesPath, 'icon.ico'), join(process.resourcesPath, 'build', 'icon.ico')]
    : [join(app.getAppPath(), 'build', 'icon.ico'), join(__dirname, '../../build/icon.ico')]

  return candidatePaths.find((candidatePath) => existsSync(candidatePath))
}

const getVideoToolDataDir = (): string => join(app.getPath('userData'), 'video-tool')
const getVideoToolDataPath = (): string => join(getVideoToolDataDir(), 'data.json')
const getVideoToolDownloadsDir = (): string => join(getVideoToolDataDir(), 'downloads')

const toFileUrl = (filePath: string): string => pathToFileURL(filePath).toString()

const ensureDataDir = async (): Promise<void> => {
  await mkdir(getVideoToolDataDir(), { recursive: true })
  await mkdir(getVideoToolDownloadsDir(), { recursive: true })
}

const readVideoToolData = async (): Promise<VideoToolData> => {
  await ensureDataDir()
  const dataPath = getVideoToolDataPath()

  if (!existsSync(dataPath)) {
    const data = createDefaultVideoToolData()
    await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8')
    return data
  }

  try {
    return sanitizeVideoToolData(JSON.parse(await readFile(dataPath, 'utf8')) as unknown)
  } catch {
    return createDefaultVideoToolData()
  }
}

const writeVideoToolData = async (data: VideoToolData): Promise<VideoToolData> => {
  await ensureDataDir()
  const sanitized = sanitizeVideoToolData(data)
  await writeFile(getVideoToolDataPath(), JSON.stringify(sanitized, null, 2), 'utf8')
  return sanitized
}

const repairTaskMediaUrls = (task: VideoTask): VideoTask => {
  const videoUrl = task.videoUrl ?? extractVideoUrl(task.raw)
  const lastFrameUrl = task.lastFrameUrl ?? extractLastFrameUrl(task.raw)
  const localFileUrl = task.localFileUrl ?? (task.localFilePath ? toFileUrl(task.localFilePath) : undefined)

  return {
    ...task,
    ...(videoUrl ? { videoUrl } : {}),
    ...(lastFrameUrl ? { lastFrameUrl } : {}),
    ...(localFileUrl ? { localFileUrl } : {})
  }
}

const getAssetTypeFromPath = (filePath: string): LocalFileUploadRequest['assetType'] | undefined => {
  const extension = extname(filePath).toLowerCase()
  if (imageExtensions.has(extension)) {
    return 'Image'
  }

  if (videoExtensions.has(extension)) {
    return 'Video'
  }

  if (audioExtensions.has(extension)) {
    return 'Audio'
  }

  return undefined
}

const getMimeTypeFromPath = (filePath: string): string => {
  return mimeByExtension[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

const getAssetTypeFromMimeType = (mimeType: string): LocalFileUploadRequest['assetType'] | undefined => {
  if (mimeType.startsWith('image/')) {
    return 'Image'
  }

  if (mimeType.startsWith('video/')) {
    return 'Video'
  }

  if (mimeType.startsWith('audio/')) {
    return 'Audio'
  }

  return undefined
}

const extensionFromMimeType = (mimeType: string): string => {
  const extension = Object.entries(mimeByExtension).find((entry) => entry[1] === mimeType)?.[0]
  if (extension) {
    return extension
  }

  if (mimeType === 'image/png') {
    return '.png'
  }

  if (mimeType === 'image/jpeg') {
    return '.jpg'
  }

  return '.bin'
}

const getFileFilters = (assetType?: LocalFileUploadRequest['assetType']): Electron.FileFilter[] => {
  const imageFilter = { name: '图片素材', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'gif'] }
  const videoFilter = { name: '视频素材', extensions: ['mp4', 'mov'] }
  const audioFilter = { name: '音频素材', extensions: ['wav', 'mp3'] }

  if (assetType === 'Image') {
    return [imageFilter]
  }

  if (assetType === 'Video') {
    return [videoFilter]
  }

  if (assetType === 'Audio') {
    return [audioFilter]
  }

  return [
    { name: '参考素材', extensions: [...imageFilter.extensions, ...videoFilter.extensions, ...audioFilter.extensions] },
    imageFilter,
    videoFilter,
    audioFilter
  ]
}

const assertFileSize = (assetType: LocalFileUploadRequest['assetType'], size: number): void => {
  const limits: Record<LocalFileUploadRequest['assetType'], number> = {
    Image: 20 * 1024 * 1024,
    Video: 500 * 1024 * 1024,
    Audio: 100 * 1024 * 1024
  }
  const limit = limits[assetType]

  if (size > limit) {
    throw new Error(`素材文件过大。${assetType} 当前限制为 ${Math.round(limit / 1024 / 1024)}MB。`)
  }
}

const isPublicHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value.trim())
    const host = url.hostname.toLowerCase()
    const privateIp =
      /^10\./.test(host) ||
      /^127\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)

    return (url.protocol === 'http:' || url.protocol === 'https:') && host !== 'localhost' && !privateIp
  } catch {
    return false
  }
}

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds))

const rejectLocalAssetImport = async (): Promise<LocalAssetImportResult> => {
  const plan = assetService.planLocalFileUpload()
  throw new Error(plan.ok ? '本地文件上传需要先接入对象存储。' : plan.message)
}

const redactSettingsForRenderer = (settings: VideoToolSettings): VideoToolSettings => ({
  ...settings,
  objectStorage: redactObjectStorageConfig(settings.objectStorage)
})

const isMaskedSecret = (value: string | undefined): boolean => Boolean(value?.includes('*'))

const mergeObjectStorageConfig = (existing: ObjectStorageConfig, incoming: ObjectStorageConfig): ObjectStorageConfig => {
  const sanitized = sanitizeObjectStorageConfig(incoming)
  return {
    ...sanitized,
    accessKeyId: isMaskedSecret(sanitized.accessKeyId) || !sanitized.accessKeyId ? existing.accessKeyId : sanitized.accessKeyId,
    accessKeySecret:
      isMaskedSecret(sanitized.accessKeySecret) || !sanitized.accessKeySecret ? existing.accessKeySecret : sanitized.accessKeySecret,
    secretId: isMaskedSecret(sanitized.secretId) || !sanitized.secretId ? existing.secretId : sanitized.secretId,
    secretKey: isMaskedSecret(sanitized.secretKey) || !sanitized.secretKey ? existing.secretKey : sanitized.secretKey,
    securityToken: isMaskedSecret(sanitized.securityToken) || !sanitized.securityToken ? existing.securityToken : sanitized.securityToken,
    stsToken: isMaskedSecret(sanitized.stsToken) || !sanitized.stsToken ? existing.stsToken : sanitized.stsToken
  }
}

const getMediaUrl = (item: VideoGenerationRequest['content'][number]): string | undefined => {
  if (item.type === 'image_url') {
    return item.image_url.url
  }

  if (item.type === 'video_url') {
    return item.video_url.url
  }

  if (item.type === 'audio_url') {
    return item.audio_url.url
  }

  return undefined
}

const validateAssetReferencesForGeneration = (request: VideoGenerationRequest, data: VideoToolData): void => {
  const assetsByUrl = new Map(data.assetCache.items.map((asset) => [asset.assetUrl, asset]))

  for (const item of request.content) {
    const url = getMediaUrl(item)?.trim()
    if (!url) {
      continue
    }

    if (url.startsWith('file://') || /^asset:\/\/local-/i.test(url) || /^[a-z]:\\/i.test(url)) {
      throw new Error('本地文件不能直接用于 Seedance 生成。请先通过素材库 API 上传公网 URL，等待 Active 后使用返回的 asset:// 地址。')
    }

    if (/^asset:\/\//i.test(url)) {
      const normalizedUrl = url.replace(/^asset:\/\//i, 'asset://')
      const asset = assetsByUrl.get(normalizedUrl)
      if (!asset) {
        throw new Error(`素材 ${normalizedUrl} 不在当前 API 素材库缓存中，请刷新素材库后重新选择。`)
      }

      if (asset.status !== 'Active') {
        throw new Error(`素材 ${asset.name} 当前状态为 ${asset.status}，只有 Active 素材可以用于生成。`)
      }
    }
  }
}

const getProviderConfig = (settings: VideoToolSettings, provider = settings.activeProvider): VideoProviderConfig => {
  return settings.providers[provider]
}

const getConfiguredProviderConfig = (settings: VideoToolSettings, provider = settings.activeProvider): VideoProviderConfig => {
  const config = getProviderConfig(settings, provider)
  if (!config.apiKey.trim()) {
    throw new Error('请先在设置中配置当前服务商的 API Key。')
  }

  if (!config.baseUrl.trim()) {
    throw new Error('请先在设置中配置当前服务商的 baseUrl。')
  }

  return config
}

const createProviderService = (provider: VideoTask['provider']): VideoTaskService => {
  return new VideoTaskService(
    provider === 'volcengine' ? createVolcengineSeedanceProvider() : createHoodMagicVideoProvider()
  )
}

const emitTaskEvent = (event: VideoTaskEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('video-tool:video-task-event', event)
  }
}

const saveAndEmitTask = async (task: VideoTask, eventType: VideoTaskEvent['type'] = 'updated'): Promise<VideoTask> => {
  const normalizedTask = repairTaskMediaUrls(task)
  const data = await readVideoToolData()
  const nextData = await writeVideoToolData(upsertVideoTask(data, normalizedTask))
  const savedTask = nextData.tasks.find((item) => item.id === normalizedTask.id) ?? normalizedTask
  emitTaskEvent({ type: eventType, task: savedTask })
  void cacheTaskVideoPreview(savedTask)
  return savedTask
}

const refreshTaskById = async (taskId: string): Promise<VideoTask | undefined> => {
  const data = await readVideoToolData()
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task || isTerminalVideoTaskStatus(task.status)) {
    return task
  }

  const config = getConfiguredProviderConfig(data.settings, task.provider)
  const refreshed = await createProviderService(task.provider).refreshTask(task, config)
  return saveAndEmitTask(refreshed)
}

const pollActiveTasks = async (): Promise<void> => {
  const data = await readVideoToolData()
  const activeTasks = data.tasks.filter((task) => !isTerminalVideoTaskStatus(task.status))

  for (const task of activeTasks) {
    try {
      const config = getConfiguredProviderConfig(data.settings, task.provider)
      const refreshed = await createProviderService(task.provider).refreshTask(task, config)
      await saveAndEmitTask(refreshed)
    } catch (error) {
      console.warn('[video-tool main] task polling failed', task.id, error)
    }
  }
}

const startPolling = (): void => {
  if (pollTimer) {
    return
  }

  pollTimer = setInterval(() => {
    void pollActiveTasks()
  }, POLL_INTERVAL_MS)
}

const getHoodMagicAssetConfig = async (): Promise<VideoProviderConfig> => {
  const data = await readVideoToolData()
  if (data.settings.activeProvider !== 'hoodmagic') {
    throw new Error('素材库 API 当前使用 HoodMagic 自有接口。请在右上角切换到 HoodMagic API，并配置 baseUrl 与 API Key。')
  }

  const config = getConfiguredProviderConfig(data.settings, 'hoodmagic')
  return config
}

const waitForAssetReady = async (config: VideoProviderConfig, createdAsset: AssetItem): Promise<AssetItem> => {
  let latestAsset = createdAsset

  for (let attempt = 0; attempt < ASSET_STATUS_POLL_ATTEMPTS; attempt += 1) {
    latestAsset = await assetService.getAsset(config, createdAsset.id)
    if (latestAsset.status === 'Active' || latestAsset.status === 'Failed') {
      return latestAsset
    }

    await sleep(ASSET_STATUS_POLL_INTERVAL_MS)
  }

  return latestAsset
}

const createTemporaryUploadFile = async (
  bytes: ArrayBuffer,
  fileName: string,
  mimeType: string
): Promise<{ filePath: string; fileName: string; mimeType: string; size: number }> => {
  const extension = extname(fileName) || extensionFromMimeType(mimeType)
  const baseName = basename(fileName, extname(fileName)).replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || 'clipboard-asset'
  const safeFileName = `${baseName.slice(0, 80)}${extension}`
  const filePath = join(tmpdir(), `hoodmagic-upload-${randomUUID()}-${safeFileName}`)
  const buffer = Buffer.from(bytes)
  await writeFile(filePath, buffer)

  return {
    filePath,
    fileName: safeFileName,
    mimeType,
    size: buffer.byteLength
  }
}

const resolveLocalUploadFile = async (
  request: LocalFileUploadRequest
): Promise<{
  cancelled: boolean
  filePath?: string
  fileName?: string
  mimeType?: string
  size?: number
  assetType?: LocalFileUploadRequest['assetType']
  temporaryFilePath?: string
}> => {
  if (request.bytes) {
    const mimeType = request.mimeType?.trim() || 'image/png'
    const fileName = request.fileName?.trim() || `clipboard-${Date.now()}${extensionFromMimeType(mimeType)}`
    const temporaryFile = await createTemporaryUploadFile(request.bytes, fileName, mimeType)
    const detectedType = getAssetTypeFromMimeType(mimeType) ?? getAssetTypeFromPath(temporaryFile.filePath)
    const assetType = request.assetType ?? detectedType

    if (!assetType || (detectedType && detectedType !== assetType)) {
      throw new Error('剪贴板或拖拽文件类型与素材类型不匹配。')
    }

    return {
      cancelled: false,
      ...temporaryFile,
      assetType,
      temporaryFilePath: temporaryFile.filePath
    }
  }

  if (request.filePath?.trim()) {
    const filePath = request.filePath.trim()
    const detectedType = getAssetTypeFromPath(filePath)
    const assetType = request.assetType ?? detectedType
    if (!assetType || (detectedType && detectedType !== assetType)) {
      throw new Error('选择的文件类型与素材类型不匹配。')
    }

    const fileInfo = await stat(filePath)
    return {
      cancelled: false,
      filePath,
      fileName: request.fileName?.trim() || basename(filePath),
      mimeType: request.mimeType?.trim() || getMimeTypeFromPath(filePath),
      size: fileInfo.size,
      assetType
    }
  }

  const result = await dialog.showOpenDialog({
    title: '选择要上传到对象存储的素材',
    properties: ['openFile'],
    filters: getFileFilters(request.assetType)
  })

  if (result.canceled || result.filePaths.length === 0 || !result.filePaths[0]) {
    return { cancelled: true }
  }

  const filePath = result.filePaths[0]
  const detectedType = getAssetTypeFromPath(filePath)
  const assetType = request.assetType ?? detectedType
  if (!assetType || (detectedType && detectedType !== assetType)) {
    throw new Error('选择的文件类型与素材类型不匹配。')
  }

  const fileInfo = await stat(filePath)
  return {
    cancelled: false,
    filePath,
    fileName: basename(filePath),
    mimeType: getMimeTypeFromPath(filePath),
    size: fileInfo.size,
    assetType
  }
}

const uploadLocalAssetFile = async (request: LocalFileUploadRequest): Promise<LocalFileUploadResult> => {
  if (!request.groupId || request.groupId <= 0) {
    throw new Error('本地文件上传前必须选择一个自建素材库分组。')
  }

  const data = await readVideoToolData()
  const objectStorageConfig = data.settings.objectStorage
  if (!objectStorageConfig.enabled) {
    throw new Error('未配置对象存储。请先到设置页开启并配置对象存储上传。')
  }

  const uploadFile = await resolveLocalUploadFile(request)
  if (uploadFile.cancelled) {
    return { cancelled: true }
  }

  if (!uploadFile.filePath || !uploadFile.fileName || !uploadFile.mimeType || uploadFile.size === undefined || !uploadFile.assetType) {
    throw new Error('无法读取待上传素材文件。')
  }

  const { filePath, fileName, mimeType, size, assetType } = uploadFile
  assertFileSize(assetType, size)
  let storage: NonNullable<LocalFileUploadResult['storage']> | undefined

  try {
    storage = await objectStorageService.uploadFile(
      {
        filePath,
        fileName,
        mimeType,
        size
      },
      objectStorageConfig
    )

    if (!storage.publicUrl.trim()) {
      throw new Error('对象存储上传成功，但无法构造公网 URL。')
    }

    if (!isPublicHttpUrl(storage.publicUrl)) {
      throw new Error(`对象存储公网 URL 无效或疑似内网地址：${storage.publicUrl}`)
    }

    if (!objectStorageConfig.autoCreateSeedanceAsset) {
      return {
        cancelled: false,
        storage
      }
    }

    const seedanceConfig = getConfiguredProviderConfig(data.settings, 'hoodmagic')
    const createdAsset = await assetService.createAsset(seedanceConfig, {
      url: storage.publicUrl,
      assetType,
      name: request.name?.trim() || fileName,
      groupId: request.groupId
    })
    const asset = objectStorageConfig.autoPollAssetActive
      ? await waitForAssetReady(seedanceConfig, createdAsset)
      : createdAsset

    const refreshedData = await readVideoToolData()
    const groups = await assetService.listGroups(seedanceConfig)
    const assetList = await assetService.listAssets(seedanceConfig, { pageNumber: 1, pageSize: 80, groupId: request.groupId })
    await writeVideoToolData(updateAssetCache(refreshedData, groups, assetList.items))

    return {
      cancelled: false,
      storage,
      asset
    }
  } catch (error) {
    console.warn('[video-tool main] seedance asset creation failed after object storage upload', error)

    if (storage) {
      return {
        cancelled: false,
        storage,
        errorMessage: error instanceof Error ? error.message : '对象存储上传成功，但 Seedance 素材创建失败。'
      }
    }

    throw error
  } finally {
    if (uploadFile.temporaryFilePath) {
      void unlink(uploadFile.temporaryFilePath).catch(() => undefined)
    }
  }
}

const uploadObjectStorageTestFile = async () => {
  const data = await readVideoToolData()
  const objectStorageConfig = data.settings.objectStorage
  if (!objectStorageConfig.enabled) {
    throw new Error('未配置对象存储。请先到设置页开启并配置对象存储上传。')
  }

  const result = await dialog.showOpenDialog({
    title: '选择对象存储测试文件',
    properties: ['openFile'],
    filters: getFileFilters()
  })

  if (result.canceled || result.filePaths.length === 0 || !result.filePaths[0]) {
    throw new Error('已取消选择测试文件。')
  }

  const filePath = result.filePaths[0]
  const assetType = getAssetTypeFromPath(filePath)
  if (!assetType) {
    throw new Error('不支持的测试文件类型。')
  }

  const fileInfo = await stat(filePath)
  assertFileSize(assetType, fileInfo.size)
  return objectStorageService.uploadFile(
    {
      filePath,
      fileName: basename(filePath),
      mimeType: getMimeTypeFromPath(filePath),
      size: fileInfo.size
    },
    objectStorageConfig
  )
}

const downloadVideoForTask = async (task: VideoTask, settings: VideoToolSettings): Promise<string> => {
  if (!task.videoUrl) {
    throw new Error('No video URL is available for this task.')
  }

  const response = await fetch(task.videoUrl)
  if (!response.ok) {
    throw new Error(`Failed to download video: HTTP ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const configuredDir = settings.downloadDirectory ?? settings.providers[task.provider].downloadDirectory
  const downloadDir = configuredDir?.trim() || getVideoToolDownloadsDir()
  await mkdir(downloadDir, { recursive: true })
  const remoteName = basename(new URL(task.videoUrl).pathname)
  const extension = extname(remoteName) || '.mp4'
  const fileName = `${task.id}${extension}`
  const filePath = join(downloadDir, fileName)

  await writeFile(filePath, buffer)
  return filePath
}

const cacheTaskVideoPreview = async (task: VideoTask): Promise<void> => {
  const normalizedTask = repairTaskMediaUrls(task)
  if (normalizedTask.status !== 'succeeded' || !normalizedTask.videoUrl || normalizedTask.localFilePath) {
    return
  }

  if (previewCacheInFlight.has(normalizedTask.id)) {
    return
  }

  previewCacheInFlight.add(normalizedTask.id)
  try {
    const data = await readVideoToolData()
    const latestTask = repairTaskMediaUrls(data.tasks.find((item) => item.id === normalizedTask.id) ?? normalizedTask)
    if (!latestTask.videoUrl || latestTask.localFilePath) {
      return
    }

    const filePath = await downloadVideoForTask(latestTask, data.settings)
    const updatedTask = repairTaskMediaUrls({
      ...latestTask,
      localFilePath: filePath,
      localFileUrl: toFileUrl(filePath),
      updatedAt: new Date().toISOString()
    })
    const latestData = await readVideoToolData()
    const savedData = await writeVideoToolData(upsertVideoTask(latestData, updatedTask))
    const savedTask = savedData.tasks.find((item) => item.id === updatedTask.id) ?? updatedTask
    emitTaskEvent({ type: 'updated', task: savedTask })
  } catch (error) {
    console.warn('[video-tool main] preview cache failed', normalizedTask.id, error)
  } finally {
    previewCacheInFlight.delete(normalizedTask.id)
  }
}

const listRepairedTasks = async (): Promise<VideoTask[]> => {
  const data = await readVideoToolData()
  const repairedTasks = data.tasks.map(repairTaskMediaUrls)
  const changed = repairedTasks.some((task, index) => JSON.stringify(task) !== JSON.stringify(data.tasks[index]))

  if (changed) {
    await writeVideoToolData({
      ...data,
      tasks: repairedTasks
    })
  }

  for (const task of repairedTasks) {
    void cacheTaskVideoPreview(task)
  }

  return repairedTasks
}

const registerIpc = (): void => {
  ipcMain.handle('video-tool:get-settings', async (): Promise<VideoToolSettings> => {
    const data = await readVideoToolData()
    return redactSettingsForRenderer(data.settings)
  })

  ipcMain.handle('video-tool:get-session-state', async (): Promise<VideoSessionState> => {
    const data = await readVideoToolData()
    return getVideoSessionState(data)
  })

  ipcMain.handle('video-tool:create-conversation', async (_event, projectId?: string | null): Promise<VideoSessionState> => {
    const data = await readVideoToolData()
    const result = createVideoConversation(data, projectId ? { projectId } : {})
    const nextData = await writeVideoToolData(result.data)
    return getVideoSessionState(nextData)
  })

  ipcMain.handle('video-tool:set-active-conversation', async (_event, conversationId: string): Promise<VideoSessionState> => {
    const data = await readVideoToolData()
    const nextData = await writeVideoToolData(setActiveVideoConversation(data, conversationId))
    return getVideoSessionState(nextData)
  })

  ipcMain.handle('video-tool:create-project', async (_event, name: string): Promise<VideoSessionState> => {
    const data = await readVideoToolData()
    const projectResult = createVideoProject(data, name)
    const conversationResult = createVideoConversation(projectResult.data, {
      projectId: projectResult.project.id,
      title: '新对话'
    })
    const nextData = await writeVideoToolData(conversationResult.data)
    return getVideoSessionState(nextData)
  })

  ipcMain.handle('video-tool:delete-project', async (_event, projectId: string): Promise<VideoSessionState> => {
    const data = await readVideoToolData()
    const nextData = await writeVideoToolData(deleteVideoProject(data, projectId))
    return getVideoSessionState(nextData)
  })

  ipcMain.handle('video-tool:delete-conversation', async (_event, conversationId: string): Promise<VideoSessionState> => {
    const data = await readVideoToolData()
    const nextData = await writeVideoToolData(deleteVideoConversation(data, conversationId))
    return getVideoSessionState(nextData)
  })

  ipcMain.handle(
    'video-tool:rename-conversation',
    async (_event, conversationId: string, title: string): Promise<VideoSessionState> => {
      const data = await readVideoToolData()
      const nextData = await writeVideoToolData(renameVideoConversation(data, conversationId, title))
      return getVideoSessionState(nextData)
    }
  )

  ipcMain.handle(
    'video-tool:move-conversation',
    async (_event, conversationId: string, projectId?: string | null): Promise<VideoSessionState> => {
      const data = await readVideoToolData()
      const nextData = await writeVideoToolData(moveVideoConversation(data, conversationId, projectId ?? undefined))
      return getVideoSessionState(nextData)
    }
  )

  ipcMain.handle('video-tool:get-active-provider-config', async (): Promise<VideoProviderConfig> => {
    const data = await readVideoToolData()
    return getProviderConfig(data.settings)
  })

  ipcMain.handle('video-tool:save-settings', async (_event, settings: VideoToolSettings): Promise<VideoToolSettings> => {
    const data = await readVideoToolData()
    const nextSettings = sanitizeVideoToolSettings(settings)
    const nextData = await writeVideoToolData({
      ...data,
      settings: {
        ...nextSettings,
        objectStorage: data.settings.objectStorage
      }
    })

    return redactSettingsForRenderer(nextData.settings)
  })

  ipcMain.handle('video-tool:create-video-task', async (_event, request: VideoGenerationRequest): Promise<VideoTask> => {
    const data = await readVideoToolData()
    const config = getConfiguredProviderConfig(data.settings, request.provider)
    validateAssetReferencesForGeneration(request, data)
    const created = await createProviderService(request.provider).createTask(request, config)
    return saveAndEmitTask(
      {
        ...created,
        ...(request.conversationId ? { conversationId: request.conversationId } : {}),
        prompt: request.prompt,
        mode: request.mode,
        request
      },
      'created'
    )
  })

  ipcMain.handle('video-tool:refresh-video-task', async (_event, taskId: string): Promise<VideoTask | undefined> => {
    return refreshTaskById(taskId)
  })

  ipcMain.handle('video-tool:cancel-video-task', async (_event, taskId: string): Promise<VideoTask | undefined> => {
    const data = await readVideoToolData()
    const task = data.tasks.find((item) => item.id === taskId)
    if (!task) {
      return undefined
    }

    if (!canCancelVideoTask(task)) {
      throw new VideoProviderError(
        'task_not_cancellable',
        task.provider === 'volcengine'
          ? 'Volcengine official API can only cancel queued tasks. Running tasks cannot be cancelled.'
          : 'This task cannot be cancelled in its current status.'
      )
    }

    const config = getConfiguredProviderConfig(data.settings, task.provider)
    const cancelled = await createProviderService(task.provider).cancelTask(task, config)
    return cancelled ? saveAndEmitTask(cancelled) : undefined
  })

  ipcMain.handle('video-tool:delete-video-task', async (_event, taskId: string): Promise<void> => {
    const data = await readVideoToolData()
    await writeVideoToolData(removeVideoTask(data, taskId))
    const deletedTask = data.tasks.find((task) => task.id === taskId)
    if (deletedTask) {
      emitTaskEvent({ type: 'deleted', task: deletedTask })
    }
  })

  ipcMain.handle('video-tool:list-video-tasks', async (): Promise<VideoTask[]> => {
    return listRepairedTasks()
  })

  ipcMain.handle('video-tool:download-video', async (_event, taskId: string): Promise<{ filePath: string }> => {
    const data = await readVideoToolData()
    const task = data.tasks.find((item) => item.id === taskId)
    if (!task) {
      throw new Error('Task not found.')
    }

    const filePath = await downloadVideoForTask(task, data.settings)
    const updatedTask: VideoTask = {
      ...task,
      localFilePath: filePath,
      localFileUrl: toFileUrl(filePath),
      updatedAt: new Date().toISOString()
    }
    await saveAndEmitTask(updatedTask)
    void shell.showItemInFolder(filePath)
    return { filePath }
  })

  ipcMain.handle('video-tool:get-object-storage-config', async (): Promise<ObjectStorageConfig> => {
    const data = await readVideoToolData()
    return redactObjectStorageConfig(data.settings.objectStorage)
  })

  ipcMain.handle(
    'video-tool:save-object-storage-config',
    async (_event, config: ObjectStorageConfig): Promise<ObjectStorageConfig> => {
      const data = await readVideoToolData()
      const objectStorage = mergeObjectStorageConfig(data.settings.objectStorage, config)
      const nextData = await writeVideoToolData({
        ...data,
        settings: {
          ...data.settings,
          objectStorage
        }
      })
      return redactObjectStorageConfig(nextData.settings.objectStorage)
    }
  )

  ipcMain.handle('video-tool:test-object-storage-connection', async (): Promise<ObjectStorageTestResult> => {
    const data = await readVideoToolData()
    return objectStorageService.testConnection(data.settings.objectStorage)
  })

  ipcMain.handle('video-tool:test-object-storage-sts', async (): Promise<ObjectStorageTestResult> => {
    const data = await readVideoToolData()
    const credentials = await getTemporaryCredentials(data.settings.objectStorage)
    if (data.settings.objectStorage.vendor === 'tencent-cos') {
      if (!credentials.secretId?.trim() || !credentials.secretKey?.trim()) {
        throw new Error('STS 接口未返回腾讯 COS 需要的 secretId/secretKey。')
      }
    } else if (!credentials.accessKeyId?.trim() || !credentials.accessKeySecret?.trim()) {
      throw new Error('STS 接口未返回对象存储需要的 accessKeyId/accessKeySecret。')
    }
    return {
      ok: true,
      message: 'STS 临时凭证接口测试成功。'
    }
  })

  ipcMain.handle('video-tool:test-object-storage-upload-file', async () => {
    return uploadObjectStorageTestFile()
  })

  ipcMain.handle('video-tool:list-asset-groups', async (): Promise<AssetGroup[]> => {
    return assetService.listGroups(await getHoodMagicAssetConfig())
  })

  ipcMain.handle('video-tool:create-asset-group', async (_event, name: string): Promise<AssetGroup> => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('请输入素材库分组名称。')
    }

    return assetService.createGroup(await getHoodMagicAssetConfig(), trimmedName)
  })

  ipcMain.handle('video-tool:delete-asset-group', async (_event, id: number): Promise<void> => {
    if (id <= 0 && id !== -2) {
      throw new Error('只能删除接口返回的自建分组，或文档中的历史分组 id=-2。')
    }

    await assetService.deleteGroup(await getHoodMagicAssetConfig(), id)
  })

  ipcMain.handle('video-tool:transfer-asset-group', async (_event, id: number, tokenId: number): Promise<void> => {
    if (!Number.isInteger(tokenId) || tokenId <= 0) {
      throw new Error('目标 token_id 必须是正整数。')
    }

    await assetService.transferGroup(await getHoodMagicAssetConfig(), id, tokenId)
  })

  ipcMain.handle('video-tool:create-asset', async (_event, request: CreateAssetRequest): Promise<AssetItem> => {
    const config = await getHoodMagicAssetConfig()
    const createdAsset = await assetService.createAsset(config, request)
    return waitForAssetReady(config, createdAsset)
  })

  ipcMain.handle('video-tool:list-assets', async (_event, request?: AssetListRequest) => {
    const config = await getHoodMagicAssetConfig()
    const result = await assetService.listAssets(config, request)

    if (request?.groupId === undefined) {
      const data = await readVideoToolData()
      const groups = await assetService.listGroups(config)
      await writeVideoToolData(updateAssetCache(data, groups, result.items))
    }

    return result
  })

  ipcMain.handle('video-tool:get-asset', async (_event, id: string): Promise<AssetItem> => {
    return assetService.getAsset(await getHoodMagicAssetConfig(), id)
  })

  ipcMain.handle('video-tool:rename-asset', async (_event, id: string, name: string): Promise<void> => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('请输入素材名称。')
    }

    await assetService.renameAsset(await getHoodMagicAssetConfig(), id, trimmedName)
  })

  ipcMain.handle('video-tool:delete-asset', async (_event, id: string): Promise<void> => {
    await assetService.deleteAsset(await getHoodMagicAssetConfig(), id)
  })

  ipcMain.handle('video-tool:import-local-assets', async () => {
    return rejectLocalAssetImport()
  })

  ipcMain.handle('video-tool:upload-local-asset-file', async (_event, request: LocalFileUploadRequest) => {
    return uploadLocalAssetFile(request)
  })

  ipcMain.handle('video-tool:plan-local-asset-upload', () => {
    return assetService.planLocalFileUpload()
  })
}

const createWindow = (): void => {
  const preloadPath = join(__dirname, '../preload/index.js')
  const isDev = Boolean(process.env.ELECTRON_RENDERER_URL)
  const windowIconPath = getWindowIconPath()

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    title: WINDOW_TITLE,
    ...(windowIconPath ? { icon: windowIconPath } : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.removeMenu()
  mainWindow.setAutoHideMenuBar(true)
  mainWindow.setMenuBarVisibility(false)
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
    mainWindow.setTitle(WINDOW_TITLE)
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    return
  }

  void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
}

void app.whenReady().then(async () => {
  await ensureDataDir()
  registerIpc()
  Menu.setApplicationMenu(null)
  createWindow()
  startPolling()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = undefined
  }
})
