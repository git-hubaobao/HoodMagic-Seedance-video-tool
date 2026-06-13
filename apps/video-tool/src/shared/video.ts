import type {
  AssetGroup,
  AssetItem,
  AssetListRequest,
  AssetListResult,
  CreateAssetRequest,
  ImportLocalAssetsRequest,
  LocalFileUploadRequest,
  LocalFileUploadResult,
  LocalAssetUploadPlan,
  LocalAssetImportResult,
  ObjectStorageConfig,
  ObjectStorageTestResult,
  ObjectStorageUploadResult,
  VideoGenerationRequest,
  VideoProviderConfig,
  VideoTask,
  VideoTaskEvent,
  VideoTaskEventCallback
} from '@hoodmagic/video-core'
import type { VideoSessionState, VideoToolSettings } from '@hoodmagic/storage'

export type VideoToolApi = {
  getSettings: () => Promise<VideoToolSettings>
  saveSettings: (settings: VideoToolSettings) => Promise<VideoToolSettings>
  getSessionState: () => Promise<VideoSessionState>
  createConversation: (projectId?: string | null) => Promise<VideoSessionState>
  setActiveConversation: (conversationId: string) => Promise<VideoSessionState>
  createProject: (name: string) => Promise<VideoSessionState>
  deleteProject: (projectId: string) => Promise<VideoSessionState>
  deleteConversation: (conversationId: string) => Promise<VideoSessionState>
  renameConversation: (conversationId: string, title: string) => Promise<VideoSessionState>
  moveConversation: (conversationId: string, projectId?: string | null) => Promise<VideoSessionState>
  createVideoTask: (request: VideoGenerationRequest) => Promise<VideoTask>
  refreshVideoTask: (taskId: string) => Promise<VideoTask | undefined>
  cancelVideoTask: (taskId: string) => Promise<VideoTask | undefined>
  deleteVideoTask: (taskId: string) => Promise<void>
  listVideoTasks: () => Promise<VideoTask[]>
  downloadVideo: (taskId: string) => Promise<{ filePath: string }>
  listAssetGroups: () => Promise<AssetGroup[]>
  createAssetGroup: (name: string) => Promise<AssetGroup>
  deleteAssetGroup: (id: number) => Promise<void>
  transferAssetGroup: (id: number, tokenId: number) => Promise<void>
  createAsset: (request: CreateAssetRequest) => Promise<AssetItem>
  listAssets: (request?: AssetListRequest) => Promise<AssetListResult>
  getAsset: (id: string) => Promise<AssetItem>
  renameAsset: (id: string, name: string) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  importLocalAssets: (request?: ImportLocalAssetsRequest) => Promise<LocalAssetImportResult>
  uploadLocalAssetFile: (request: LocalFileUploadRequest) => Promise<LocalFileUploadResult>
  planLocalAssetUpload: () => Promise<LocalAssetUploadPlan>
  getObjectStorageConfig: () => Promise<ObjectStorageConfig>
  saveObjectStorageConfig: (config: ObjectStorageConfig) => Promise<ObjectStorageConfig>
  testObjectStorageConnection: () => Promise<ObjectStorageTestResult>
  testObjectStorageSts: () => Promise<ObjectStorageTestResult>
  testObjectStorageUploadFile: () => Promise<ObjectStorageUploadResult>
  getActiveProviderConfig: () => Promise<VideoProviderConfig>
  onVideoTaskEvent: (callback: VideoTaskEventCallback) => () => void
}

export type { VideoTaskEvent }
