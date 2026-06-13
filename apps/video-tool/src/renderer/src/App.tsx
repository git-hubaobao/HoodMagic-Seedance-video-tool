import { Check, ChevronDown, Folder, Library, ListVideo, MoreHorizontal, Plus, Settings, Trash2, WandSparkles, X } from 'lucide-react'
import type { ComponentType, JSX } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { AssetGroup, AssetItem, VideoTask } from '@hoodmagic/video-core'
import type { InterfaceLanguage, VideoConversation, VideoProject, VideoSessionState, VideoToolSettings } from '@hoodmagic/storage'

import { copyToClipboard, getVideoToolApi, hasVideoToolBridge } from './api'
import { AssetLibraryView } from './views/AssetLibraryView'
import { GenerateView } from './views/GenerateView'
import { SettingsView } from './views/SettingsView'
import { TaskHistoryView } from './views/TaskHistoryView'
import { SelectMenu } from './components/SelectMenu'

type ViewKey = 'generate' | 'assets' | 'tasks'

const COLLAPSED_PROJECTS_STORAGE_KEY = 'hoodmagic-sd.collapsed-projects'
const UNGROUPED_PROJECT_KEY = '__ungrouped__'

const projectCollapseKey = (projectId?: string): string => projectId ?? UNGROUPED_PROJECT_KEY

const readCollapsedProjectIds = (): Set<string> => {
  try {
    const rawValue = window.localStorage.getItem(COLLAPSED_PROJECTS_STORAGE_KEY)
    const parsedValue = rawValue ? (JSON.parse(rawValue) as unknown) : []
    if (!Array.isArray(parsedValue)) {
      return new Set<string>()
    }

    return new Set(parsedValue.filter((value): value is string => typeof value === 'string' && value.length > 0))
  } catch (storageError) {
    console.warn('[video-tool] failed to read collapsed projects', storageError)
    return new Set<string>()
  }
}

const navViews: Array<{ key: ViewKey; icon: ComponentType<{ size?: number }> }> = [
  { key: 'generate', icon: WandSparkles },
  { key: 'assets', icon: Library },
  { key: 'tasks', icon: ListVideo }
]

const providerLabel = (provider: VideoToolSettings['activeProvider'] | string | undefined): string => {
  if (provider === 'volcengine') {
    return '火山引擎官方'
  }

  return '自定义服务商'
}

const copy = {
  zh: {
    product: 'Seedance 视频生成',
    newChat: '+ 新建聊天',
    newProject: '新建项目',
    createProject: '创建项目',
    cancel: '取消',
    projectNamePrompt: '项目名称',
    defaultProjectName: '新项目',
    projectCreated: '项目已创建。',
    projectDeleted: '项目已删除。',
    chatDeleted: '聊天已删除。',
    chatMoved: '聊天已移动。',
    chatRenamed: '聊天已重命名。',
    deleteProject: '删除项目',
    deleteChat: '删除聊天',
    moreActions: '更多操作',
    renameChat: '重命名聊天',
    renameChatPrompt: '输入新的聊天名称',
    chatTitleRequired: '聊天名称不能为空。',
    collapseProject: '收起项目聊天',
    expandProject: '展开项目聊天',
    moveToProject: '移动到',
    confirmDeleteProject: (name: string) => `确定删除项目“${name}”吗？该项目下的聊天和任务也会一并删除，且不可恢复。`,
    confirmDeleteChat: (title: string) => `确定删除聊天“${title}”吗？该聊天下的任务记录也会一并删除。`,
    untitledTask: '新对话',
    projects: '项目',
    ungrouped: '未分组',
    conversations: '个会话',
    recycle: '回收站',
    generate: '视频生成',
    assets: '素材库',
    tasks: '任务历史',
    settings: '设置',
    apiSettings: '配置设置',
    close: '关闭',
    apiReady: 'API 可用',
    apiMissing: '未配置 API',
    dark: '深色',
    light: '浅色',
    chinese: '中文',
    english: 'English',
    loading: '加载中...',
    unavailable: '设置不可用。',
    preloadMissing: 'Electron preload API 不可用。请通过 `pnpm dev` 打开的桌面窗口运行。',
    saved: '设置已保存。',
    assetLoadFailed: '素材库加载失败。',
    initialLoadFailed: '应用状态加载失败。',
    downloaded: '已保存到',
    cancelled: '任务已取消。',
    deleted: '任务记录已删除。',
    copied: '已复制。'
  },
  en: {
    product: 'Seedance 视频生成',
    newChat: '+ New chat',
    newProject: 'New project',
    createProject: 'Create project',
    cancel: 'Cancel',
    projectNamePrompt: 'Project name',
    defaultProjectName: 'New project',
    projectCreated: 'Project created.',
    projectDeleted: 'Project deleted.',
    chatDeleted: 'Chat deleted.',
    chatMoved: 'Chat moved.',
    chatRenamed: 'Chat renamed.',
    deleteProject: 'Delete project',
    deleteChat: 'Delete chat',
    moreActions: 'More actions',
    renameChat: 'Rename chat',
    renameChatPrompt: 'Enter a new chat name',
    chatTitleRequired: 'Chat name is required.',
    collapseProject: 'Collapse project chats',
    expandProject: 'Expand project chats',
    moveToProject: 'Move to',
    confirmDeleteProject: (name: string) => `Delete project "${name}"? Its chats and task history will be deleted too.`,
    confirmDeleteChat: (title: string) => `Delete chat "${title}" and its task history?`,
    untitledTask: 'New chat',
    projects: 'Projects',
    ungrouped: 'Ungrouped',
    conversations: 'chats',
    recycle: 'Trash',
    generate: 'Video generation',
    assets: 'Assets',
    tasks: 'Task history',
    settings: 'Settings',
    apiSettings: 'Configuration',
    close: 'Close',
    apiReady: 'API ready',
    apiMissing: 'API missing',
    dark: 'Dark',
    light: 'Light',
    chinese: '中文',
    english: 'English',
    loading: 'Loading...',
    unavailable: 'Settings unavailable.',
    preloadMissing: 'Electron preload API is unavailable. Open the desktop window with `pnpm dev`.',
    saved: 'Settings saved.',
    assetLoadFailed: 'Asset library failed to load.',
    initialLoadFailed: 'App state failed to load.',
    downloaded: 'Saved to',
    cancelled: 'Task cancelled.',
    deleted: 'Task record deleted.',
    copied: 'Copied.'
  }
} as const

export default function App(): JSX.Element {
  const api = useMemo(() => getVideoToolApi(), [])
  const bridgeReady = hasVideoToolBridge(api)
  const [view, setView] = useState<ViewKey>('generate')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [settings, setSettings] = useState<VideoToolSettings | undefined>()
  const [session, setSession] = useState<VideoSessionState>({ projects: [], conversations: [] })
  const [tasks, setTasks] = useState<VideoTask[]>([])
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [groups, setGroups] = useState<AssetGroup[]>([])
  const [toast, setToast] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(() => readCollapsedProjectIds())
  const [openConversationMenuId, setOpenConversationMenuId] = useState<string | undefined>()
  const [openConversationMoveMenuId, setOpenConversationMoveMenuId] = useState<string | undefined>()
  const [renamingConversationId, setRenamingConversationId] = useState<string | undefined>()
  const [renamingConversationTitle, setRenamingConversationTitle] = useState('')

  const activeProviderConfig = settings ? settings.providers[settings.activeProvider] : undefined
  const language = settings?.interfaceLanguage ?? 'zh'
  const t = copy[language]
  const providerConfigured = Boolean(activeProviderConfig?.apiKey.trim() && activeProviderConfig.baseUrl.trim())
  const activeConversation = session.conversations.find((conversation) => conversation.id === session.activeConversationId)
  const activeProjectId = activeConversation?.projectId
  const visibleTasks = activeConversation
    ? tasks.filter((task) => task.conversationId === activeConversation.id)
    : tasks

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }, [])

  const showError = useCallback((message: string) => {
    setError(message)
    window.setTimeout(() => setError(''), 5200)
  }, [])

  const loadTasks = useCallback(async () => {
    if (!bridgeReady) {
      return
    }
    setTasks(await api.listVideoTasks())
  }, [api, bridgeReady])

  const loadSession = useCallback(async () => {
    if (!bridgeReady) {
      return
    }
    setSession(await api.getSessionState())
  }, [api, bridgeReady])

  const loadAssets = useCallback(async () => {
    if (!bridgeReady) {
      return
    }
    try {
      const [nextGroups, assetResult] = await Promise.all([
        api.listAssetGroups(),
        api.listAssets({ pageNumber: 1, pageSize: 60 })
      ])
      setGroups(nextGroups)
      setAssets(assetResult.items)
    } catch (assetError) {
      showError(assetError instanceof Error ? assetError.message : t.assetLoadFailed)
    }
  }, [api, bridgeReady, showError, t.assetLoadFailed])

  const loadInitialState = useCallback(async () => {
    if (!bridgeReady) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const nextSettings = await api.getSettings()
      const nextSession = await api.getSessionState()
      const nextTasks = await api.listVideoTasks()
      setSettings(nextSettings)
      setSession(nextSession)
      setTasks(nextTasks)
      await loadAssets()
    } catch (initialError) {
      showError(initialError instanceof Error ? initialError.message : t.initialLoadFailed)
    } finally {
      setLoading(false)
    }
  }, [api, bridgeReady, loadAssets, showError, t.initialLoadFailed])

  useEffect(() => {
    void loadInitialState()
  }, [loadInitialState])

  useEffect(() => {
    if (!bridgeReady) {
      return undefined
    }

    return api.onVideoTaskEvent((event) => {
      setTasks((currentTasks) => {
        if (event.type === 'deleted') {
          return currentTasks.filter((task) => task.id !== event.task.id)
        }

        const exists = currentTasks.some((task) => task.id === event.task.id)
        return exists
          ? currentTasks.map((task) => (task.id === event.task.id ? event.task : task))
          : [event.task, ...currentTasks]
      })
      void loadSession()
    })
  }, [api, bridgeReady, loadSession])

  useEffect(() => {
    if (settings?.appearanceTheme) {
      document.documentElement.dataset.theme = settings.appearanceTheme
    }
  }, [settings?.appearanceTheme])

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_PROJECTS_STORAGE_KEY, JSON.stringify([...collapsedProjectIds]))
    } catch (storageError) {
      console.warn('[video-tool] failed to save collapsed projects', storageError)
    }
  }, [collapsedProjectIds])

  useEffect(() => {
    if (!openConversationMenuId) {
      return undefined
    }

    const closeMenu = (event: PointerEvent): void => {
      if (event.target instanceof Element && event.target.closest('.conversation-menu')) {
        return
      }

      setOpenConversationMenuId(undefined)
      setOpenConversationMoveMenuId(undefined)
    }

    window.addEventListener('pointerdown', closeMenu)
    return () => window.removeEventListener('pointerdown', closeMenu)
  }, [openConversationMenuId])

  useEffect(() => {
    if (!openConversationMenuId && !renamingConversationId) {
      return undefined
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return
      }

      setOpenConversationMenuId(undefined)
      setOpenConversationMoveMenuId(undefined)
      setRenamingConversationId(undefined)
      setRenamingConversationTitle('')
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [openConversationMenuId, renamingConversationId])

  useEffect(() => {
    if (!settingsOpen && !projectDialogOpen) {
      return undefined
    }

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        setProjectDialogOpen(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [projectDialogOpen, settingsOpen])

  const saveSettings = useCallback(
    async (nextSettings: VideoToolSettings) => {
      if (!bridgeReady) {
        return
      }
      const saved = await api.saveSettings(nextSettings)
      setSettings(saved)
      showToast(t.saved)
    },
    [api, bridgeReady, showToast, t.saved]
  )

  const patchSettings = useCallback(
    async (patch: Partial<VideoToolSettings>) => {
      if (!settings) {
        return
      }
      await saveSettings({ ...settings, ...patch })
    },
    [saveSettings, settings]
  )

  const downloadTask = useCallback(
    async (taskId: string) => {
      if (!bridgeReady) {
        return
      }
      const result = await api.downloadVideo(taskId)
      await loadTasks()
      showToast(`${t.downloaded} ${result.filePath}`)
    },
    [api, bridgeReady, loadTasks, showToast, t.downloaded]
  )

  const cancelTask = useCallback(
    async (taskId: string) => {
      if (!bridgeReady) {
        return
      }
      await api.cancelVideoTask(taskId)
      await loadTasks()
      showToast(t.cancelled)
    },
    [api, bridgeReady, loadTasks, showToast, t.cancelled]
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (!bridgeReady) {
        return
      }
      await api.deleteVideoTask(taskId)
      await loadTasks()
      showToast(t.deleted)
    },
    [api, bridgeReady, loadTasks, showToast, t.deleted]
  )

  const copyValue = useCallback(
    async (value: string, label: string = t.copied) => {
      await copyToClipboard(value)
      showToast(label)
    },
    [showToast, t.copied]
  )

  const createConversation = useCallback(
    async (projectId?: string) => {
      if (!bridgeReady) {
        return
      }
      try {
        const nextSession = await api.createConversation(projectId ?? null)
        setSession(nextSession)
        await loadTasks()
        setView('generate')
      } catch (conversationError) {
        console.error('[video-tool] create conversation failed', conversationError)
        showError(conversationError instanceof Error ? conversationError.message : '新建聊天失败。')
      }
    },
    [api, bridgeReady, loadTasks, showError]
  )

  const openProjectDialog = useCallback(() => {
    setProjectName(t.defaultProjectName)
    setProjectDialogOpen(true)
  }, [t.defaultProjectName])

  const submitCreateProject = useCallback(async () => {
    if (!bridgeReady) {
      return
    }

    const name = projectName.trim() || t.defaultProjectName
    try {
      const nextSession = await api.createProject(name)
      setSession(nextSession)
      await loadTasks()
      setView('generate')
      setProjectDialogOpen(false)
      setProjectName('')
      showToast(t.projectCreated)
    } catch (projectError) {
      console.error('[video-tool] create project failed', projectError)
      showError(projectError instanceof Error ? projectError.message : '新建项目失败。')
    }
  }, [api, bridgeReady, loadTasks, projectName, showError, showToast, t.defaultProjectName, t.projectCreated])

  const deleteProject = useCallback(
    async (project: VideoProject) => {
      if (!bridgeReady || !window.confirm(t.confirmDeleteProject(project.name))) {
        return
      }

      try {
        const nextSession = await api.deleteProject(project.id)
        setSession(nextSession)
        await loadTasks()
        showToast(t.projectDeleted)
      } catch (projectError) {
        console.error('[video-tool] delete project failed', projectError)
        showError(projectError instanceof Error ? projectError.message : '删除项目失败。')
      }
    },
    [api, bridgeReady, loadTasks, showError, showToast, t]
  )

  const deleteConversation = useCallback(
    async (conversation: VideoConversation) => {
      if (!bridgeReady || !window.confirm(t.confirmDeleteChat(conversation.title || t.untitledTask))) {
        return
      }

      try {
        const nextSession = await api.deleteConversation(conversation.id)
        setSession(nextSession)
        await loadTasks()
        showToast(t.chatDeleted)
      } catch (conversationError) {
        console.error('[video-tool] delete conversation failed', conversationError)
        showError(conversationError instanceof Error ? conversationError.message : '删除聊天失败。')
      }
    },
    [api, bridgeReady, loadTasks, showError, showToast, t]
  )

  const startRenameConversation = useCallback(
    (conversation: VideoConversation) => {
      setOpenConversationMenuId(undefined)
      setOpenConversationMoveMenuId(undefined)
      setRenamingConversationId(conversation.id)
      setRenamingConversationTitle(conversation.title || t.untitledTask)
    },
    [t.untitledTask]
  )

  const cancelRenameConversation = useCallback(() => {
    setRenamingConversationId(undefined)
    setRenamingConversationTitle('')
  }, [])

  const submitRenameConversation = useCallback(
    async (conversation: VideoConversation) => {
      if (!bridgeReady) {
        return
      }

      const trimmedTitle = renamingConversationTitle.trim()
      if (!trimmedTitle) {
        showError(t.chatTitleRequired)
        return
      }

      if (trimmedTitle === conversation.title) {
        cancelRenameConversation()
        return
      }

      try {
        const nextSession = await api.renameConversation(conversation.id, trimmedTitle)
        setSession(nextSession)
        cancelRenameConversation()
        showToast(t.chatRenamed)
      } catch (conversationError) {
        console.error('[video-tool] rename conversation failed', conversationError)
        showError(conversationError instanceof Error ? conversationError.message : '重命名聊天失败。')
      }
    },
    [
      api,
      bridgeReady,
      cancelRenameConversation,
      renamingConversationTitle,
      showError,
      showToast,
      t.chatRenamed,
      t.chatTitleRequired
    ]
  )

  const moveConversation = useCallback(
    async (conversation: VideoConversation, nextProjectId?: string) => {
      if (!bridgeReady || conversation.projectId === nextProjectId) {
        return
      }

      try {
        const nextSession = await api.moveConversation(conversation.id, nextProjectId ?? null)
        setSession(nextSession)
        setView('generate')
        showToast(t.chatMoved)
      } catch (conversationError) {
        console.error('[video-tool] move conversation failed', conversationError)
        showError(conversationError instanceof Error ? conversationError.message : '移动聊天失败。')
      }
    },
    [api, bridgeReady, showError, showToast, t.chatMoved]
  )

  const selectConversation = useCallback(
    async (conversationId: string) => {
      if (!bridgeReady) {
        return
      }

      const nextSession = await api.setActiveConversation(conversationId)
      setSession(nextSession)
      setView('generate')
    },
    [api, bridgeReady]
  )

  const isProjectCollapsed = useCallback(
    (projectId?: string): boolean => collapsedProjectIds.has(projectCollapseKey(projectId)),
    [collapsedProjectIds]
  )

  const toggleProjectCollapsed = useCallback((projectId?: string) => {
    const collapseKey = projectCollapseKey(projectId)
    setCollapsedProjectIds((currentProjectIds) => {
      const nextProjectIds = new Set(currentProjectIds)
      if (nextProjectIds.has(collapseKey)) {
        nextProjectIds.delete(collapseKey)
      } else {
        nextProjectIds.add(collapseKey)
      }
      return nextProjectIds
    })
  }, [])

  const taskCountByConversation = useMemo(() => {
    const counts = new Map<string, number>()
    for (const task of tasks) {
      if (task.conversationId) {
        counts.set(task.conversationId, (counts.get(task.conversationId) ?? 0) + 1)
      }
    }
    return counts
  }, [tasks])

  const getConversationCount = useCallback(
    (conversation: VideoConversation): number => taskCountByConversation.get(conversation.id) ?? conversation.taskIds.length,
    [taskCountByConversation]
  )

  const getProjectConversations = useCallback(
    (projectId?: string): VideoConversation[] =>
      session.conversations
        .filter((conversation) => conversation.projectId === projectId)
        .sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt)),
    [session.conversations]
  )

  const sortedProjects = useMemo(
    () => [...session.projects].sort((a: VideoProject, b: VideoProject) => a.sortOrder - b.sortOrder),
    [session.projects]
  )

  const openProjectInGenerate = useCallback(
    async (projectId?: string): Promise<void> => {
      const latestConversation = getProjectConversations(projectId)[0]
      if (latestConversation) {
        await selectConversation(latestConversation.id)
        return
      }

      setView('generate')
    },
    [getProjectConversations, selectConversation]
  )

  const renderConversationCard = (conversation: VideoConversation): JSX.Element => {
    const isRenaming = renamingConversationId === conversation.id
    const menuOpen = openConversationMenuId === conversation.id
    const moveOptions = [
      { id: undefined, name: t.ungrouped },
      ...sortedProjects.map((project) => ({ id: project.id, name: project.name }))
    ]
    const moveSubmenuOpen = openConversationMoveMenuId === conversation.id

    return (
      <div
        className="conversation-card"
        data-conversation-id={conversation.id}
        data-selected={session.activeConversationId === conversation.id ? 'true' : 'false'}
        key={conversation.id}
      >
        {isRenaming ? (
          <form
            className="conversation-rename-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submitRenameConversation(conversation)
            }}
          >
            <input
              aria-label={t.renameChatPrompt}
              autoFocus
              onChange={(event) => setRenamingConversationTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  cancelRenameConversation()
                }
              }}
              value={renamingConversationTitle}
            />
            <button className="icon-button success-icon" title={t.renameChat} type="submit">
              <Check size={13} />
            </button>
            <button
              className="icon-button"
              onClick={cancelRenameConversation}
              title={t.cancel}
              type="button"
            >
              <X size={13} />
            </button>
          </form>
        ) : (
          <button className="conversation-main" onClick={() => void selectConversation(conversation.id)} type="button">
            <strong>{conversation.title || t.untitledTask}</strong>
            <span>{new Date(conversation.lastMessageAt ?? conversation.updatedAt).toLocaleString()} · {getConversationCount(conversation)}</span>
          </button>
        )}
        <div className="conversation-menu">
          <button
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="conversation-menu-button icon-button"
            onClick={() => {
              setOpenConversationMenuId(menuOpen ? undefined : conversation.id)
              setOpenConversationMoveMenuId(undefined)
            }}
            title={t.moreActions}
            type="button"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen ? (
            <div className="conversation-menu-popover" role="menu">
              <button
                className="conversation-menu-item"
                onClick={() => startRenameConversation(conversation)}
                role="menuitem"
                type="button"
              >
                {t.renameChat}
              </button>
              <div className="conversation-menu-section" role="group">
                <button
                  aria-expanded={moveSubmenuOpen}
                  className="conversation-menu-item conversation-submenu-trigger"
                  onClick={() =>
                    setOpenConversationMoveMenuId((currentId) => (currentId === conversation.id ? undefined : conversation.id))
                  }
                  role="menuitem"
                  type="button"
                >
                  <span>{t.moveToProject}</span>
                  <ChevronDown size={13} />
                </button>
                {moveSubmenuOpen ? (
                  <div className="conversation-submenu" role="group">
                    {moveOptions.map((project) => {
                      const projectId = project.id
                      const selected = (conversation.projectId ?? '') === (projectId ?? '')
                      return (
                        <button
                          className="conversation-menu-item"
                          data-selected={selected ? 'true' : 'false'}
                          disabled={selected}
                          key={projectId ?? 'ungrouped'}
                          onClick={() => {
                            setOpenConversationMenuId(undefined)
                            setOpenConversationMoveMenuId(undefined)
                            void moveConversation(conversation, projectId)
                          }}
                          role="menuitem"
                          type="button"
                        >
                          {project.name}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              <button
                className="conversation-menu-item danger-menu-item"
                onClick={() => {
                  setOpenConversationMenuId(undefined)
                  void deleteConversation(conversation)
                }}
                role="menuitem"
                type="button"
              >
                {t.deleteChat}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  const ungroupedConversations = getProjectConversations(undefined)
  const ungroupedCollapsed = isProjectCollapsed(undefined)

  if (!bridgeReady) {
    return (
      <main className="bridge-missing">
        <div>
          <h1>HoodMagic</h1>
          <p>{t.preloadMissing}</p>
        </div>
      </main>
    )
  }

  return (
    <div className="app-shell" data-theme={settings?.appearanceTheme ?? 'dark'}>
      <aside className="sidebar">
        <div className="brand">
          <img alt="HoodMagic" className="brand-mark" src="icon.png" />
          <div>
            <strong>HoodMagic</strong>
            <span>{t.product}</span>
          </div>
        </div>
        <button className="new-chat-button" onClick={() => void createConversation(activeProjectId)} type="button">
          <span>{t.newChat}</span>
        </button>
        <div className="project-list">
          <div className="sidebar-section-title">
            <span>{t.projects}</span>
            <button className="project-add-button" onClick={openProjectDialog} title={t.newProject} type="button">
              <Plus size={14} />
            </button>
          </div>
          <div className="project-group" data-project-id="ungrouped">
            <div className="project-group-head">
              <button
                aria-expanded={!ungroupedCollapsed}
                className="project-collapse-button"
                onClick={() => toggleProjectCollapsed(undefined)}
                title={ungroupedCollapsed ? t.expandProject : t.collapseProject}
                type="button"
              >
                <ChevronDown size={14} />
              </button>
              <button className="project-title-button" onClick={() => void openProjectInGenerate(undefined)} type="button">
                <Folder size={15} />
                <span>{t.ungrouped}</span>
                <strong>{ungroupedConversations.length} {t.conversations}</strong>
              </button>
            </div>
            {!ungroupedCollapsed ? (
              <div className="conversation-list">
                {ungroupedConversations.map(renderConversationCard)}
              </div>
            ) : null}
          </div>
          {sortedProjects.map((project) => {
            const conversations = getProjectConversations(project.id)
            const collapsed = isProjectCollapsed(project.id)
            return (
              <div className="project-group" data-project-id={project.id} key={project.id}>
                <div className="project-group-head">
                  <button
                    aria-expanded={!collapsed}
                    className="project-collapse-button"
                    onClick={() => toggleProjectCollapsed(project.id)}
                    title={collapsed ? t.expandProject : t.collapseProject}
                    type="button"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button className="project-title-button" onClick={() => void openProjectInGenerate(project.id)} type="button">
                    <Folder size={15} />
                    <span>{project.name}</span>
                    <strong>{conversations.length} {t.conversations}</strong>
                  </button>
                  <button
                    className="project-delete-button danger-icon"
                    onClick={() => void deleteProject(project)}
                    title={t.deleteProject}
                    type="button"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {!collapsed ? (
                  <div className="conversation-list">
                    {conversations.map(renderConversationCard)}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <nav className="nav-list">
          {navViews.map((item) => {
            const Icon = item.icon
            return (
              <button
                aria-pressed={view === item.key}
                className="nav-button"
                key={item.key}
                onClick={() => setView(item.key)}
                type="button"
              >
                <Icon size={16} />
                <span>{t[item.key]}</span>
              </button>
            )
          })}
        </nav>
        <div className="sidebar-status">
          <span className={providerConfigured ? 'api-pill ready' : 'api-pill missing'}>
            {providerLabel(settings?.activeProvider)}
          </span>
          <span className={providerConfigured ? 'api-pill ready' : 'api-pill missing'}>
            {providerConfigured ? t.apiReady : t.apiMissing}
          </span>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="topbar-actions">
            <span className={providerConfigured ? 'api-pill ready' : 'api-pill missing'}>
              {providerConfigured ? t.apiReady : t.apiMissing}
            </span>
            <SelectMenu
              className="topbar-select provider-select"
              onChange={(value) => void patchSettings({ activeProvider: value as VideoToolSettings['activeProvider'] })}
              options={[
                { value: 'hoodmagic', label: '自定义服务商' },
                { value: 'volcengine', label: '火山引擎官方' }
              ]}
              value={settings?.activeProvider ?? 'hoodmagic'}
            />
            <SelectMenu
              className="topbar-select"
              onChange={(value) => void patchSettings({ appearanceTheme: value as VideoToolSettings['appearanceTheme'] })}
              options={[
                { value: 'dark', label: t.dark },
                { value: 'light', label: t.light }
              ]}
              value={settings?.appearanceTheme ?? 'dark'}
            />
            <SelectMenu
              className="topbar-select"
              onChange={(value) => void patchSettings({ interfaceLanguage: value as InterfaceLanguage })}
              options={[
                { value: 'zh', label: t.chinese },
                { value: 'en', label: t.english }
              ]}
              value={language}
            />
            <button className="topbar-settings-button" onClick={() => setSettingsOpen(true)} type="button">
              <Settings size={15} />
              <span>{t.settings}</span>
            </button>
          </div>
        </header>

        {loading ? (
          <div className="loading-pane">{t.loading}</div>
        ) : settings ? (
          <>
            {view === 'generate' && (
              <GenerateView
                api={api}
                assets={assets}
                groups={groups}
                settings={settings}
                {...(session.activeConversationId ? { conversationId: session.activeConversationId } : {})}
                language={language}
                tasks={visibleTasks}
                onCancelTask={cancelTask}
                onCopy={copyValue}
                onDownloadTask={downloadTask}
                onError={showError}
                onRefreshAssets={loadAssets}
                onRefreshTasks={async () => {
                  await loadTasks()
                  await loadSession()
                }}
                onToast={showToast}
              />
            )}
            {view === 'assets' && (
              <AssetLibraryView
                api={api}
                assets={assets}
                groups={groups}
                onCopy={copyValue}
                onError={showError}
                onRefresh={loadAssets}
                onToast={showToast}
              />
            )}
            {view === 'tasks' && (
              <TaskHistoryView
                tasks={tasks}
                onCancelTask={cancelTask}
                onCopy={copyValue}
                onDeleteTask={deleteTask}
                onDownloadTask={downloadTask}
                onError={showError}
                onRefreshTasks={loadTasks}
              />
            )}
          </>
        ) : (
          <div className="loading-pane">{t.unavailable}</div>
        )}
      </section>

      {projectDialogOpen ? (
        <div className="dialog-backdrop" onClick={() => setProjectDialogOpen(false)} role="presentation">
          <section
            aria-label={t.newProject}
            aria-modal="true"
            className="project-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header>
              <p className="eyebrow">{t.projects}</p>
              <h2>{t.newProject}</h2>
            </header>
            <label className="field">
              <span>{t.projectNamePrompt}</span>
              <input
                autoFocus
                onChange={(event) => setProjectName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void submitCreateProject()
                  }
                }}
                value={projectName}
              />
            </label>
            <footer>
              <button className="secondary-button" onClick={() => setProjectDialogOpen(false)} type="button">
                {t.cancel}
              </button>
              <button className="primary-button compact-primary" onClick={() => void submitCreateProject()} type="button">
                {t.createProject}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {settingsOpen && settings ? (
        <div className="settings-modal-backdrop" onClick={() => setSettingsOpen(false)} role="presentation">
          <section
            aria-label={t.apiSettings}
            aria-modal="true"
            className="settings-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="settings-modal-header">
              <h2>{t.apiSettings}</h2>
              <button className="secondary-button" onClick={() => setSettingsOpen(false)} type="button">
                {t.close}
              </button>
            </header>
            <div className="settings-modal-body">
              <SettingsView
                api={api}
                settings={settings}
                onError={showError}
                onObjectStorageSaved={(objectStorage) =>
                  setSettings((current) => (current ? { ...current, objectStorage } : current))
                }
                onSave={saveSettings}
                onToast={showToast}
              />
            </div>
          </section>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
      {error ? <div className="toast error-toast">{error}</div> : null}
    </div>
  )
}
