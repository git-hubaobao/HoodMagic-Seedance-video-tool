import type { VideoToolApi } from '../../shared/video'

export const getVideoToolApi = (): VideoToolApi | undefined => {
  return (window as Window & { videoTool?: VideoToolApi }).videoTool
}

export const hasVideoToolBridge = (api: VideoToolApi | undefined): api is VideoToolApi => {
  return Boolean(
    api &&
      typeof api.getSettings === 'function' &&
      typeof api.saveSettings === 'function' &&
      typeof api.getSessionState === 'function' &&
      typeof api.createConversation === 'function' &&
      typeof api.createProject === 'function' &&
      typeof api.deleteProject === 'function' &&
      typeof api.deleteConversation === 'function' &&
      typeof api.moveConversation === 'function' &&
      typeof api.createVideoTask === 'function' &&
      typeof api.createAsset === 'function' &&
      typeof api.uploadLocalAssetFile === 'function' &&
      typeof api.getObjectStorageConfig === 'function' &&
      typeof api.saveObjectStorageConfig === 'function' &&
      typeof api.testObjectStorageUploadFile === 'function' &&
      typeof api.listAssetGroups === 'function' &&
      typeof api.listAssets === 'function' &&
      typeof api.listVideoTasks === 'function' &&
      typeof api.onVideoTaskEvent === 'function'
  )
}

export const copyToClipboard = async (value: string): Promise<void> => {
  await navigator.clipboard.writeText(value)
}
