import {
  builtInVideoModels,
  type AssetGroup,
  type AssetItem,
  type ObjectStorageAuthMode,
  type ObjectStorageConfig,
  type ObjectStorageVendor,
  type VideoModelConfig,
  type VideoProviderConfig,
  type VideoProviderType,
  type VideoRatio,
  type VideoResolution,
  type VideoTask
} from '@hoodmagic/video-core'

export type AppearanceTheme = 'dark' | 'light'
export type InterfaceLanguage = 'zh' | 'en'

export type VideoToolSettings = {
  appearanceTheme: AppearanceTheme
  interfaceLanguage: InterfaceLanguage
  activeProvider: VideoProviderType
  providers: Record<VideoProviderType, VideoProviderConfig>
  objectStorage: ObjectStorageConfig
  downloadDirectory?: string
}

export type VideoProject = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  sortOrder: number
}

export type VideoConversation = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  sortOrder: number
  projectId?: string
  lastMessageAt?: string
  taskIds: string[]
}

export type VideoSessionState = {
  projects: VideoProject[]
  conversations: VideoConversation[]
  activeConversationId?: string
}

export type LocalAssetCache = {
  groups: AssetGroup[]
  items: AssetItem[]
  updatedAt?: string
}

export type VideoToolData = {
  version: 1
  settings: VideoToolSettings
  projects: VideoProject[]
  conversations: VideoConversation[]
  activeConversationId?: string
  tasks: VideoTask[]
  assetCache: LocalAssetCache
}

const defaultResolution: VideoResolution = '720p'
const defaultRatio: VideoRatio = 'adaptive'

const createProviderConfig = (provider: VideoProviderType): VideoProviderConfig => ({
  provider,
  baseUrl: provider === 'volcengine' ? 'https://ark.cn-beijing.volces.com' : '',
  apiKey: '',
  defaultModel: builtInVideoModels[0]?.id ?? 'doubao-seedance-2-0-260128',
  defaultResolution,
  defaultRatio,
  defaultDuration: 5,
  generateAudio: false,
  enableWebSearch: false,
  models: builtInVideoModels
})

export const createDefaultObjectStorageConfig = (): ObjectStorageConfig => ({
  enabled: false,
  vendor: 'aliyun-oss',
  authMode: 'sts',
  credentialRefreshBeforeExpireSeconds: 300,
  region: 'oss-cn-beijing',
  endpoint: 'oss-cn-beijing.aliyuncs.com',
  bucket: '',
  keyPrefix: 'hoodmagic-assets/',
  publicDomain: '',
  generatePublicUrl: true,
  autoCreateSeedanceAsset: true,
  autoPollAssetActive: true,
  stsEndpointUrl: '',
  stsRequestHeaders: ''
})

export const createDefaultVideoToolSettings = (): VideoToolSettings => ({
  appearanceTheme: 'dark',
  interfaceLanguage: 'zh',
  activeProvider: 'hoodmagic',
  providers: {
    hoodmagic: createProviderConfig('hoodmagic'),
    volcengine: createProviderConfig('volcengine')
  },
  objectStorage: createDefaultObjectStorageConfig()
})

export const createDefaultVideoToolData = (): VideoToolData => ({
  version: 1,
  settings: createDefaultVideoToolSettings(),
  projects: [],
  conversations: [],
  tasks: [],
  assetCache: {
    groups: [],
    items: []
  }
})

const isVideoProviderType = (value: unknown): value is VideoProviderType => value === 'hoodmagic' || value === 'volcengine'

const isObjectStorageVendor = (value: unknown): value is ObjectStorageVendor =>
  value === 'aliyun-oss' || value === 'volcengine-tos' || value === 'tencent-cos'

const isObjectStorageAuthMode = (value: unknown): value is ObjectStorageAuthMode =>
  value === 'long_term_key' || value === 'sts'

const isAppearanceTheme = (value: unknown): value is AppearanceTheme => value === 'dark' || value === 'light'

const isInterfaceLanguage = (value: unknown): value is InterfaceLanguage => value === 'zh' || value === 'en'

const isVideoResolution = (value: unknown): value is VideoResolution =>
  value === '480p' || value === '720p' || value === '1080p'

const isVideoRatio = (value: unknown): value is VideoRatio =>
  value === 'adaptive' ||
  value === '16:9' ||
  value === '9:16' ||
  value === '1:1' ||
  value === '4:3' ||
  value === '3:4' ||
  value === '21:9'

const asRecord = (value: unknown): Record<string, unknown> => {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

const asString = (value: unknown, fallback: string): string => {
  return typeof value === 'string' ? value : fallback
}

const asBoolean = (value: unknown, fallback: boolean): boolean => {
  return typeof value === 'boolean' ? value : fallback
}

const asNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

const createId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const taskTitle = (task: VideoTask | undefined, fallback = '新对话'): string => {
  const title = (task?.prompt || task?.request?.prompt || fallback).trim()
  return title.length > 42 ? `${title.slice(0, 42)}...` : title
}

const sanitizeModelConfig = (value: unknown): VideoModelConfig | undefined => {
  const record = asRecord(value)
  const id = asString(record.id, '').trim()
  if (!id) {
    return undefined
  }

  return {
    id,
    label: asString(record.label, id),
    provider:
      record.provider === 'hoodmagic' || record.provider === 'volcengine' || record.provider === 'both'
        ? record.provider
        : 'both',
    supports1080p: asBoolean(record.supports1080p, !id.includes('fast')),
    supportsWebSearch: asBoolean(record.supportsWebSearch, /seedance-2-0/i.test(id)),
    supportsReturnLastFrame: asBoolean(record.supportsReturnLastFrame, /seedance-2-0/i.test(id)),
    durationMin: asNumber(record.durationMin, /seedance-2-0/i.test(id) ? 4 : 2),
    durationMax: asNumber(record.durationMax, /seedance-2-0/i.test(id) ? 15 : 12),
    allowSmartDuration: asBoolean(record.allowSmartDuration, /seedance-2-0/i.test(id))
  }
}

const sanitizeModels = (value: unknown): VideoModelConfig[] => {
  const incoming = Array.isArray(value) ? value.map(sanitizeModelConfig).filter((model): model is VideoModelConfig => Boolean(model)) : []
  const byId = new Map<string, VideoModelConfig>()
  for (const model of [...builtInVideoModels, ...incoming]) {
    byId.set(model.id, model)
  }

  return [...byId.values()]
}

const sanitizeProviderConfig = (provider: VideoProviderType, value: unknown): VideoProviderConfig => {
  const defaults = createProviderConfig(provider)
  const record = asRecord(value)
  const defaultResolutionValue = record.defaultResolution
  const defaultRatioValue = record.defaultRatio

  return {
    provider,
    baseUrl: asString(record.baseUrl, defaults.baseUrl),
    apiKey: asString(record.apiKey, ''),
    defaultModel: asString(record.defaultModel, defaults.defaultModel),
    defaultResolution: isVideoResolution(defaultResolutionValue) ? defaultResolutionValue : defaults.defaultResolution,
    defaultRatio: isVideoRatio(defaultRatioValue) ? defaultRatioValue : defaults.defaultRatio,
    defaultDuration: asNumber(record.defaultDuration, defaults.defaultDuration),
    generateAudio: asBoolean(record.generateAudio, defaults.generateAudio),
    enableWebSearch: asBoolean(record.enableWebSearch, defaults.enableWebSearch),
    models: sanitizeModels(record.models),
    ...(typeof record.downloadDirectory === 'string' ? { downloadDirectory: record.downloadDirectory } : {})
  }
}

const optionalString = (record: Record<string, unknown>, key: string): string | undefined => {
  return typeof record[key] === 'string' ? (record[key] as string) : undefined
}

export const sanitizeObjectStorageConfig = (value: unknown): ObjectStorageConfig => {
  const defaults = createDefaultObjectStorageConfig()
  const record = asRecord(value)
  const vendor = isObjectStorageVendor(record.vendor) ? record.vendor : defaults.vendor

  return {
    enabled: asBoolean(record.enabled, defaults.enabled),
    vendor,
    authMode: isObjectStorageAuthMode(record.authMode) ? record.authMode : defaults.authMode,
    ...(optionalString(record, 'accessKeyId') !== undefined ? { accessKeyId: optionalString(record, 'accessKeyId') } : {}),
    ...(optionalString(record, 'accessKeySecret') !== undefined ? { accessKeySecret: optionalString(record, 'accessKeySecret') } : {}),
    ...(optionalString(record, 'secretId') !== undefined ? { secretId: optionalString(record, 'secretId') } : {}),
    ...(optionalString(record, 'secretKey') !== undefined ? { secretKey: optionalString(record, 'secretKey') } : {}),
    ...(optionalString(record, 'securityToken') !== undefined ? { securityToken: optionalString(record, 'securityToken') } : {}),
    ...(optionalString(record, 'stsToken') !== undefined ? { stsToken: optionalString(record, 'stsToken') } : {}),
    region: asString(record.region, vendor === 'tencent-cos' ? 'ap-beijing' : vendor === 'volcengine-tos' ? 'cn-beijing' : defaults.region),
    ...(optionalString(record, 'endpoint') !== undefined ? { endpoint: optionalString(record, 'endpoint') } : {}),
    bucket: asString(record.bucket, defaults.bucket),
    keyPrefix: asString(record.keyPrefix, defaults.keyPrefix ?? ''),
    publicDomain: asString(record.publicDomain, ''),
    stsEndpointUrl: asString(record.stsEndpointUrl, ''),
    stsRequestHeaders: asString(record.stsRequestHeaders, ''),
    credentialRefreshBeforeExpireSeconds: asNumber(
      record.credentialRefreshBeforeExpireSeconds,
      defaults.credentialRefreshBeforeExpireSeconds
    ),
    generatePublicUrl: asBoolean(record.generatePublicUrl, defaults.generatePublicUrl),
    autoCreateSeedanceAsset: asBoolean(record.autoCreateSeedanceAsset, defaults.autoCreateSeedanceAsset),
    autoPollAssetActive: asBoolean(record.autoPollAssetActive, defaults.autoPollAssetActive)
  }
}

const maskSecret = (value: string | undefined): string | undefined => {
  if (!value) {
    return value
  }

  if (value.length <= 8) {
    return '********'
  }

  return `${value.slice(0, 3)}********${value.slice(-4)}`
}

export const redactObjectStorageConfig = (config: ObjectStorageConfig): ObjectStorageConfig => ({
  ...config,
  ...(config.accessKeyId ? { accessKeyId: maskSecret(config.accessKeyId) } : {}),
  ...(config.accessKeySecret ? { accessKeySecret: maskSecret(config.accessKeySecret) } : {}),
  ...(config.secretId ? { secretId: maskSecret(config.secretId) } : {}),
  ...(config.secretKey ? { secretKey: maskSecret(config.secretKey) } : {}),
  ...(config.securityToken ? { securityToken: maskSecret(config.securityToken) } : {}),
  ...(config.stsToken ? { stsToken: maskSecret(config.stsToken) } : {})
})

export const sanitizeVideoToolSettings = (value: unknown): VideoToolSettings => {
  const defaults = createDefaultVideoToolSettings()
  const record = asRecord(value)
  const providers = asRecord(record.providers)
  const activeProvider = isVideoProviderType(record.activeProvider) ? record.activeProvider : defaults.activeProvider

  return {
    appearanceTheme: isAppearanceTheme(record.appearanceTheme) ? record.appearanceTheme : defaults.appearanceTheme,
    interfaceLanguage: isInterfaceLanguage(record.interfaceLanguage) ? record.interfaceLanguage : defaults.interfaceLanguage,
    activeProvider,
    providers: {
      hoodmagic: sanitizeProviderConfig('hoodmagic', providers.hoodmagic),
      volcengine: sanitizeProviderConfig('volcengine', providers.volcengine)
    },
    objectStorage: sanitizeObjectStorageConfig(record.objectStorage),
    ...(typeof record.downloadDirectory === 'string' ? { downloadDirectory: record.downloadDirectory } : {})
  }
}

const sanitizeTask = (value: unknown): VideoTask | undefined => {
  const record = asRecord(value)
  const id = asString(record.id, '').trim()
  const provider = isVideoProviderType(record.provider) ? record.provider : undefined
  const model = asString(record.model, '').trim()
  const createdAt = asString(record.createdAt, '')

  if (!id || !provider || !model || !createdAt) {
    return undefined
  }

  return record as VideoTask
}

const sanitizeProject = (value: unknown, index: number): VideoProject | undefined => {
  const record = asRecord(value)
  const id = asString(record.id, '').trim()
  const name = asString(record.name, '').trim()
  const createdAt = asString(record.createdAt, new Date().toISOString())
  const updatedAt = asString(record.updatedAt, createdAt)

  if (!id || !name) {
    return undefined
  }

  return {
    id,
    name,
    createdAt,
    updatedAt,
    sortOrder: asNumber(record.sortOrder, index)
  }
}

const sanitizeConversation = (value: unknown, index: number): VideoConversation | undefined => {
  const record = asRecord(value)
  const id = asString(record.id, '').trim()
  const title = asString(record.title, '').trim()
  const createdAt = asString(record.createdAt, new Date().toISOString())
  const updatedAt = asString(record.updatedAt, createdAt)
  const taskIds = Array.isArray(record.taskIds)
    ? record.taskIds.filter((taskId): taskId is string => typeof taskId === 'string' && taskId.trim().length > 0)
    : []

  if (!id || !title) {
    return undefined
  }

  return {
    id,
    title,
    createdAt,
    updatedAt,
    sortOrder: asNumber(record.sortOrder, index),
    ...(typeof record.projectId === 'string' && record.projectId.trim() ? { projectId: record.projectId } : {}),
    ...(typeof record.lastMessageAt === 'string' ? { lastMessageAt: record.lastMessageAt } : {}),
    taskIds
  }
}

export const sanitizeVideoToolData = (value: unknown): VideoToolData => {
  const record = asRecord(value)
  const assetCache = asRecord(record.assetCache)
  const tasks = Array.isArray(record.tasks) ? record.tasks.map(sanitizeTask).filter((task): task is VideoTask => Boolean(task)) : []
  const projects = Array.isArray(record.projects)
    ? record.projects.map(sanitizeProject).filter((project): project is VideoProject => Boolean(project))
    : []
  let conversations = Array.isArray(record.conversations)
    ? record.conversations.map(sanitizeConversation).filter((conversation): conversation is VideoConversation => Boolean(conversation))
    : []

  if (conversations.length === 0 && tasks.length > 0) {
    const firstTask = tasks[0]
    const createdAt = firstTask?.createdAt ?? new Date().toISOString()
    const updatedAt = tasks.reduce((latest, task) => (task.updatedAt > latest ? task.updatedAt : latest), createdAt)
    const conversationId = 'conversation-default'
    conversations = [
      {
        id: conversationId,
        title: taskTitle(firstTask),
        createdAt,
        updatedAt,
        sortOrder: 0,
        lastMessageAt: updatedAt,
        taskIds: tasks.map((task) => task.id)
      }
    ]
    tasks.forEach((task) => {
      task.conversationId = conversationId
    })
  }

  const conversationIds = new Set(conversations.map((conversation) => conversation.id))
  const activeConversationId =
    typeof record.activeConversationId === 'string' && conversationIds.has(record.activeConversationId)
      ? record.activeConversationId
      : conversations[0]?.id

  return {
    version: 1,
    settings: sanitizeVideoToolSettings(record.settings),
    projects,
    conversations,
    ...(activeConversationId ? { activeConversationId } : {}),
    tasks,
    assetCache: {
      groups: Array.isArray(assetCache.groups) ? (assetCache.groups as AssetGroup[]) : [],
      items: Array.isArray(assetCache.items) ? (assetCache.items as AssetItem[]) : [],
      ...(typeof assetCache.updatedAt === 'string' ? { updatedAt: assetCache.updatedAt } : {})
    }
  }
}

export const upsertVideoTask = (data: VideoToolData, task: VideoTask): VideoToolData => {
  let conversations = data.conversations
  let activeConversationId = data.activeConversationId
  let conversationId = task.conversationId ?? activeConversationId
  const now = task.updatedAt || new Date().toISOString()

  if (!conversationId || !conversations.some((conversation) => conversation.id === conversationId)) {
    const created = createVideoConversation(data, { title: taskTitle(task) })
    conversations = created.data.conversations
    activeConversationId = created.conversation.id
    conversationId = created.conversation.id
  }

  const taskWithConversation: VideoTask = { ...task, conversationId }
  const existingIndex = data.tasks.findIndex((item) => item.id === task.id)
  const tasks =
    existingIndex >= 0
      ? data.tasks.map((item, index) => (index === existingIndex ? taskWithConversation : item))
      : [taskWithConversation, ...data.tasks]

  return {
    ...data,
    ...(activeConversationId ? { activeConversationId } : {}),
    conversations: conversations.map((conversation) => {
      if (conversation.id !== conversationId) {
        return conversation
      }

      const taskIds = [task.id, ...conversation.taskIds.filter((taskId) => taskId !== task.id)]
      const nextTitle = conversation.taskIds.length === 0 ? taskTitle(task, conversation.title) : conversation.title
      return {
        ...conversation,
        title: nextTitle,
        updatedAt: now,
        lastMessageAt: now,
        taskIds
      }
    }),
    tasks
  }
}

export const removeVideoTask = (data: VideoToolData, taskId: string): VideoToolData => {
  return {
    ...data,
    conversations: data.conversations.map((conversation) => ({
      ...conversation,
      taskIds: conversation.taskIds.filter((id) => id !== taskId)
    })),
    tasks: data.tasks.filter((task) => task.id !== taskId)
  }
}

export const getVideoSessionState = (data: VideoToolData): VideoSessionState => ({
  projects: data.projects,
  conversations: data.conversations,
  ...(data.activeConversationId ? { activeConversationId: data.activeConversationId } : {})
})

export const createVideoProject = (data: VideoToolData, name = '新项目'): { data: VideoToolData; project: VideoProject } => {
  const now = new Date().toISOString()
  const project: VideoProject = {
    id: createId('project'),
    name: name.trim() || '新项目',
    createdAt: now,
    updatedAt: now,
    sortOrder: data.projects.length
  }

  return {
    data: {
      ...data,
      projects: [...data.projects, project]
    },
    project
  }
}

const pickNextActiveConversationId = (conversations: VideoConversation[]): string | undefined => {
  return [...conversations].sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt))[0]?.id
}

export const deleteVideoProject = (data: VideoToolData, projectId: string): VideoToolData => {
  const projectExists = data.projects.some((project) => project.id === projectId)
  if (!projectExists) {
    throw new Error('Project not found.')
  }

  const removedConversationIds = new Set(
    data.conversations.filter((conversation) => conversation.projectId === projectId).map((conversation) => conversation.id)
  )
  const removedTaskIds = new Set(
    data.tasks.filter((task) => task.conversationId && removedConversationIds.has(task.conversationId)).map((task) => task.id)
  )
  const conversations = data.conversations.filter((conversation) => !removedConversationIds.has(conversation.id))
  const tasks = data.tasks.filter((task) => !removedTaskIds.has(task.id))
  const activeConversationId =
    data.activeConversationId && !removedConversationIds.has(data.activeConversationId)
      ? data.activeConversationId
      : pickNextActiveConversationId(conversations)
  const { activeConversationId: _previousActiveConversationId, ...dataWithoutActiveConversation } = data

  return {
    ...dataWithoutActiveConversation,
    projects: data.projects.filter((project) => project.id !== projectId),
    conversations,
    tasks,
    ...(activeConversationId ? { activeConversationId } : {})
  }
}

export const createVideoConversation = (
  data: VideoToolData,
  options: { projectId?: string; title?: string } = {}
): { data: VideoToolData; conversation: VideoConversation } => {
  if (options.projectId && !data.projects.some((project) => project.id === options.projectId)) {
    throw new Error('Project not found.')
  }

  const now = new Date().toISOString()
  const siblingCount = data.conversations.filter((conversation) => conversation.projectId === options.projectId).length
  const conversation: VideoConversation = {
    id: createId('conversation'),
    title: options.title?.trim() || '新对话',
    createdAt: now,
    updatedAt: now,
    sortOrder: siblingCount,
    ...(options.projectId ? { projectId: options.projectId } : {}),
    taskIds: []
  }

  return {
    data: {
      ...data,
      conversations: [conversation, ...data.conversations],
      activeConversationId: conversation.id
    },
    conversation
  }
}

export const deleteVideoConversation = (data: VideoToolData, conversationId: string): VideoToolData => {
  const conversationExists = data.conversations.some((conversation) => conversation.id === conversationId)
  if (!conversationExists) {
    throw new Error('Chat not found.')
  }

  const removedTaskIds = new Set(data.tasks.filter((task) => task.conversationId === conversationId).map((task) => task.id))
  const conversations = data.conversations.filter((conversation) => conversation.id !== conversationId)
  const tasks = data.tasks.filter((task) => !removedTaskIds.has(task.id))
  const activeConversationId =
    data.activeConversationId === conversationId ? pickNextActiveConversationId(conversations) : data.activeConversationId
  const { activeConversationId: _previousActiveConversationId, ...dataWithoutActiveConversation } = data

  return {
    ...dataWithoutActiveConversation,
    conversations,
    tasks,
    ...(activeConversationId ? { activeConversationId } : {})
  }
}

export const renameVideoConversation = (data: VideoToolData, conversationId: string, title: string): VideoToolData => {
  const nextTitle = title.trim()
  if (!nextTitle) {
    throw new Error('Chat title is required.')
  }

  const conversationExists = data.conversations.some((conversation) => conversation.id === conversationId)
  if (!conversationExists) {
    throw new Error('Chat not found.')
  }

  const now = new Date().toISOString()

  return {
    ...data,
    conversations: data.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            title: nextTitle,
            updatedAt: now
          }
        : conversation
    )
  }
}

export const moveVideoConversation = (
  data: VideoToolData,
  conversationId: string,
  projectId?: string
): VideoToolData => {
  const conversation = data.conversations.find((item) => item.id === conversationId)
  if (!conversation) {
    throw new Error('Chat not found.')
  }

  if (projectId && !data.projects.some((project) => project.id === projectId)) {
    throw new Error('Project not found.')
  }

  if (conversation.projectId === projectId) {
    return data
  }

  const now = new Date().toISOString()
  const siblingCount = data.conversations.filter((item) => item.projectId === projectId && item.id !== conversationId).length

  return {
    ...data,
    conversations: data.conversations.map((item) => {
      if (item.id !== conversationId) {
        return item
      }

      const movedConversation = {
        ...item,
        sortOrder: siblingCount,
        updatedAt: now
      }

      if (projectId) {
        return {
          ...movedConversation,
          projectId
        }
      }

      const { projectId: _projectId, ...ungroupedConversation } = movedConversation
      return ungroupedConversation
    })
  }
}

export const setActiveVideoConversation = (data: VideoToolData, conversationId: string): VideoToolData => {
  if (!data.conversations.some((conversation) => conversation.id === conversationId)) {
    return data
  }

  return {
    ...data,
    activeConversationId: conversationId
  }
}

export const updateAssetCache = (data: VideoToolData, groups: AssetGroup[], items: AssetItem[]): VideoToolData => {
  return {
    ...data,
    assetCache: {
      groups,
      items,
      updatedAt: new Date().toISOString()
    }
  }
}
