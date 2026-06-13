import { contextBridge, ipcRenderer } from 'electron'

import type {
  AssetListRequest,
  CreateAssetRequest,
  ImportLocalAssetsRequest,
  LocalFileUploadRequest,
  ObjectStorageConfig,
  VideoGenerationRequest,
  VideoTaskEvent,
  VideoTaskEventCallback
} from '@hoodmagic/video-core'
import type { VideoToolSettings } from '@hoodmagic/storage'
import type { VideoToolApi } from '../shared/video'

console.info('[video-tool preload] loaded')

const api: VideoToolApi = {
  getSettings: () => ipcRenderer.invoke('video-tool:get-settings') as Promise<VideoToolSettings>,
  saveSettings: (settings) => ipcRenderer.invoke('video-tool:save-settings', settings) as Promise<VideoToolSettings>,
  getSessionState: () =>
    ipcRenderer.invoke('video-tool:get-session-state') as ReturnType<VideoToolApi['getSessionState']>,
  createConversation: (projectId?: string | null) =>
    ipcRenderer.invoke('video-tool:create-conversation', projectId) as ReturnType<VideoToolApi['createConversation']>,
  setActiveConversation: (conversationId: string) =>
    ipcRenderer.invoke('video-tool:set-active-conversation', conversationId) as ReturnType<VideoToolApi['setActiveConversation']>,
  createProject: (name: string) =>
    ipcRenderer.invoke('video-tool:create-project', name) as ReturnType<VideoToolApi['createProject']>,
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke('video-tool:delete-project', projectId) as ReturnType<VideoToolApi['deleteProject']>,
  deleteConversation: (conversationId: string) =>
    ipcRenderer.invoke('video-tool:delete-conversation', conversationId) as ReturnType<VideoToolApi['deleteConversation']>,
  renameConversation: (conversationId: string, title: string) =>
    ipcRenderer.invoke('video-tool:rename-conversation', conversationId, title) as ReturnType<VideoToolApi['renameConversation']>,
  moveConversation: (conversationId: string, projectId?: string | null) =>
    ipcRenderer.invoke('video-tool:move-conversation', conversationId, projectId) as ReturnType<VideoToolApi['moveConversation']>,
  createVideoTask: (request: VideoGenerationRequest) =>
    ipcRenderer.invoke('video-tool:create-video-task', request) as ReturnType<VideoToolApi['createVideoTask']>,
  refreshVideoTask: (taskId: string) =>
    ipcRenderer.invoke('video-tool:refresh-video-task', taskId) as ReturnType<VideoToolApi['refreshVideoTask']>,
  cancelVideoTask: (taskId: string) =>
    ipcRenderer.invoke('video-tool:cancel-video-task', taskId) as ReturnType<VideoToolApi['cancelVideoTask']>,
  deleteVideoTask: (taskId: string) =>
    ipcRenderer.invoke('video-tool:delete-video-task', taskId) as ReturnType<VideoToolApi['deleteVideoTask']>,
  listVideoTasks: () => ipcRenderer.invoke('video-tool:list-video-tasks') as ReturnType<VideoToolApi['listVideoTasks']>,
  downloadVideo: (taskId: string) =>
    ipcRenderer.invoke('video-tool:download-video', taskId) as ReturnType<VideoToolApi['downloadVideo']>,
  listAssetGroups: () =>
    ipcRenderer.invoke('video-tool:list-asset-groups') as ReturnType<VideoToolApi['listAssetGroups']>,
  createAssetGroup: (name: string) =>
    ipcRenderer.invoke('video-tool:create-asset-group', name) as ReturnType<VideoToolApi['createAssetGroup']>,
  deleteAssetGroup: (id: number) =>
    ipcRenderer.invoke('video-tool:delete-asset-group', id) as ReturnType<VideoToolApi['deleteAssetGroup']>,
  transferAssetGroup: (id: number, tokenId: number) =>
    ipcRenderer.invoke('video-tool:transfer-asset-group', id, tokenId) as ReturnType<VideoToolApi['transferAssetGroup']>,
  createAsset: (request: CreateAssetRequest) =>
    ipcRenderer.invoke('video-tool:create-asset', request) as ReturnType<VideoToolApi['createAsset']>,
  listAssets: (request?: AssetListRequest) =>
    ipcRenderer.invoke('video-tool:list-assets', request) as ReturnType<VideoToolApi['listAssets']>,
  getAsset: (id: string) => ipcRenderer.invoke('video-tool:get-asset', id) as ReturnType<VideoToolApi['getAsset']>,
  renameAsset: (id: string, name: string) =>
    ipcRenderer.invoke('video-tool:rename-asset', id, name) as ReturnType<VideoToolApi['renameAsset']>,
  deleteAsset: (id: string) =>
    ipcRenderer.invoke('video-tool:delete-asset', id) as ReturnType<VideoToolApi['deleteAsset']>,
  importLocalAssets: (request?: ImportLocalAssetsRequest) =>
    ipcRenderer.invoke('video-tool:import-local-assets', request) as ReturnType<VideoToolApi['importLocalAssets']>,
  uploadLocalAssetFile: (request: LocalFileUploadRequest) =>
    ipcRenderer.invoke('video-tool:upload-local-asset-file', request) as ReturnType<VideoToolApi['uploadLocalAssetFile']>,
  planLocalAssetUpload: () =>
    ipcRenderer.invoke('video-tool:plan-local-asset-upload') as ReturnType<VideoToolApi['planLocalAssetUpload']>,
  getObjectStorageConfig: () =>
    ipcRenderer.invoke('video-tool:get-object-storage-config') as ReturnType<VideoToolApi['getObjectStorageConfig']>,
  saveObjectStorageConfig: (config: ObjectStorageConfig) =>
    ipcRenderer.invoke('video-tool:save-object-storage-config', config) as ReturnType<VideoToolApi['saveObjectStorageConfig']>,
  testObjectStorageConnection: () =>
    ipcRenderer.invoke('video-tool:test-object-storage-connection') as ReturnType<VideoToolApi['testObjectStorageConnection']>,
  testObjectStorageSts: () =>
    ipcRenderer.invoke('video-tool:test-object-storage-sts') as ReturnType<VideoToolApi['testObjectStorageSts']>,
  testObjectStorageUploadFile: () =>
    ipcRenderer.invoke('video-tool:test-object-storage-upload-file') as ReturnType<VideoToolApi['testObjectStorageUploadFile']>,
  getActiveProviderConfig: () =>
    ipcRenderer.invoke('video-tool:get-active-provider-config') as ReturnType<VideoToolApi['getActiveProviderConfig']>,
  onVideoTaskEvent: (callback: VideoTaskEventCallback): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, taskEvent: VideoTaskEvent) => {
      callback(taskEvent)
    }

    ipcRenderer.on('video-tool:video-task-event', listener)
    return () => {
      ipcRenderer.removeListener('video-tool:video-task-event', listener)
    }
  }
}

contextBridge.exposeInMainWorld('videoTool', api)
contextBridge.exposeInMainWorld('hoodmagic', {
  objectStorage: {
    getConfig: api.getObjectStorageConfig,
    saveConfig: api.saveObjectStorageConfig,
    testConnection: api.testObjectStorageConnection,
    uploadLocalFile: api.uploadLocalAssetFile
  }
})
