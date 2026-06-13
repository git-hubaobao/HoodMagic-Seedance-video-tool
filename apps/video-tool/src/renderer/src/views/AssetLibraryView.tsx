import {
  Copy,
  ExternalLink,
  FileAudio,
  FileVideo,
  ImagePlus,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  X
} from 'lucide-react'
import type { DragEvent, JSX } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { AssetGroup, AssetItem, AssetStatus, AssetType, LocalFileUploadResult } from '@hoodmagic/video-core'

import type { VideoToolApi } from '../../../shared/video'
import { SelectMenu } from '../components/SelectMenu'

type AssetLibraryViewProps = {
  api: VideoToolApi
  groups: AssetGroup[]
  assets: AssetItem[]
  onRefresh: () => Promise<void>
  onCopy: (value: string, label?: string) => Promise<void>
  onToast: (message: string) => void
  onError: (message: string) => void
}

const assetTypes: AssetType[] = ['Image', 'Video', 'Audio']
const assetStatuses: AssetStatus[] = ['Processing', 'Active', 'Failed', 'Unknown']
type UploadDialog = 'url' | 'local' | undefined

const statusLabel: Record<AssetStatus, string> = {
  Processing: '处理中',
  Active: '可用',
  Failed: '失败',
  Unknown: '未知'
}

const typeLabel: Record<AssetType, string> = {
  Image: '图片',
  Video: '视频',
  Audio: '音频'
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

const formatDate = (value?: string): string => {
  if (!value) {
    return '-'
  }

  return new Date(value).toLocaleString()
}

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

  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extension)) {
    return 'Image'
  }
  if (extension && ['mp4', 'mov', 'webm'].includes(extension)) {
    return 'Video'
  }
  if (extension && ['mp3', 'wav', 'm4a'].includes(extension)) {
    return 'Audio'
  }

  return undefined
}

const getAssetIcon = (type: AssetType): JSX.Element => {
  if (type === 'Video') {
    return <FileVideo size={30} />
  }
  if (type === 'Audio') {
    return <FileAudio size={30} />
  }

  return <ImagePlus size={30} />
}

export function AssetLibraryView({
  api,
  groups,
  assets,
  onRefresh,
  onCopy,
  onToast,
  onError
}: AssetLibraryViewProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadableGroups = useMemo(() => groups.filter((group) => group.id > 0), [groups])
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>()
  const [selectedUploadGroupId, setSelectedUploadGroupId] = useState<number | undefined>(uploadableGroups[0]?.id)
  const [visibleAssets, setVisibleAssets] = useState<AssetItem[]>(assets)
  const [newGroupName, setNewGroupName] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('Image')
  const [assetName, setAssetName] = useState('')
  const [assetUrl, setAssetUrl] = useState('')
  const [localAssetType, setLocalAssetType] = useState<AssetType>('Image')
  const [localAssetName, setLocalAssetName] = useState('')
  const [localUploadResult, setLocalUploadResult] = useState<LocalFileUploadResult | undefined>()
  const [assetSearch, setAssetSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<AssetType | 'All'>('All')
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'All'>('All')
  const [uploadStatus, setUploadStatus] = useState('')
  const [uploadDialog, setUploadDialog] = useState<UploadDialog>()
  const [dragActive, setDragActive] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loadingAssets, setLoadingAssets] = useState(false)

  const filteredAssets = useMemo(() => {
    const search = assetSearch.trim().toLowerCase()
    return visibleAssets.filter((asset) => {
      const matchesType = typeFilter === 'All' || asset.assetType === typeFilter
      const matchesStatus = statusFilter === 'All' || asset.status === statusFilter
      const matchesSearch =
        !search ||
        asset.name.toLowerCase().includes(search) ||
        asset.assetUrl.toLowerCase().includes(search) ||
        asset.url?.toLowerCase().includes(search)

      return matchesType && matchesStatus && matchesSearch
    })
  }, [assetSearch, statusFilter, typeFilter, visibleAssets])

  useEffect(() => {
    if (selectedGroupId === undefined) {
      setVisibleAssets(assets)
    }
  }, [assets, selectedGroupId])

  useEffect(() => {
    if (selectedUploadGroupId === undefined && uploadableGroups[0]) {
      setSelectedUploadGroupId(uploadableGroups[0].id)
      return
    }

    if (selectedUploadGroupId !== undefined && !uploadableGroups.some((group) => group.id === selectedUploadGroupId)) {
      setSelectedUploadGroupId(uploadableGroups[0]?.id)
    }
  }, [selectedUploadGroupId, uploadableGroups])

  useEffect(() => {
    if (selectedGroupId !== undefined && !groups.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(undefined)
    }
  }, [groups, selectedGroupId])

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error('[asset-library]', error)
      onError(error instanceof Error ? error.message : '素材库操作失败。')
    } finally {
      setBusy(false)
    }
  }

  const loadAssetsForGroup = async (groupId: number | undefined = selectedGroupId): Promise<void> => {
    setLoadingAssets(true)
    try {
      const result = await api.listAssets({
        pageNumber: 1,
        pageSize: 200,
        ...(groupId !== undefined ? { groupId } : {})
      })
      setVisibleAssets(result.items)
    } catch (error) {
      console.error('[asset-library] list assets failed', error)
      onError(error instanceof Error ? error.message : '素材列表加载失败。')
    } finally {
      setLoadingAssets(false)
    }
  }

  const refreshAll = async (): Promise<void> => {
    await onRefresh()
    await loadAssetsForGroup(selectedGroupId)
  }

  const selectGroup = (groupId: number | undefined): void => {
    setSelectedGroupId(groupId)
    void loadAssetsForGroup(groupId)
  }

  const openUploadDialog = (dialog: Exclude<UploadDialog, undefined>): void => {
    setUploadStatus('')
    setLocalUploadResult(undefined)
    setUploadDialog(dialog)
  }

  const closeUploadDialog = (): void => {
    setUploadDialog(undefined)
    setDragActive(false)
  }

  const createGroup = async (): Promise<void> => {
    const name = newGroupName.trim()
    if (!name) {
      onError('请输入素材库分组名称。')
      return
    }

    const group = await api.createAssetGroup(name)
    setNewGroupName('')
    setSelectedGroupId(group.id)
    setSelectedUploadGroupId(group.id)
    await onRefresh()
    await loadAssetsForGroup(group.id)
    onToast('素材库分组已创建。')
  }

  const deleteGroup = async (group: AssetGroup): Promise<void> => {
    const confirmed = window.confirm(`删除分组“${group.name}”会删除其中素材，可能不可恢复。确定删除吗？`)
    if (!confirmed) {
      return
    }

    await api.deleteAssetGroup(group.id)
    setSelectedGroupId(undefined)
    if (selectedUploadGroupId === group.id) {
      setSelectedUploadGroupId(undefined)
    }
    await onRefresh()
    await loadAssetsForGroup(undefined)
    onToast('素材库分组已删除。')
  }

  const createAsset = async (): Promise<void> => {
    const url = assetUrl.trim()
    const name = assetName.trim() || url.split('/').pop()?.split('?')[0] || 'seedance-asset'

    if (!selectedUploadGroupId || selectedUploadGroupId <= 0) {
      onError('上传素材前必须选择一个自建素材库分组。')
      return
    }

    if (!isPublicHttpUrl(url)) {
      onError('素材 URL 必须是公网可访问的 http(s) 地址，不能是本地路径、localhost 或内网地址。')
      return
    }

    setUploadStatus('正在创建 Seedance 素材并等待状态变为可用...')
    const asset = await api.createAsset({
      url,
      assetType,
      name,
      groupId: selectedUploadGroupId
    })
    setUploadStatus(asset.status === 'Active' ? '素材已可用，可用于生成。' : `素材状态：${statusLabel[asset.status]}`)
    setAssetUrl('')
    setAssetName('')
    setSelectedGroupId(selectedUploadGroupId)
    await onRefresh()
    await loadAssetsForGroup(selectedUploadGroupId)
    onToast(asset.status === 'Active' ? `素材已可用：${asset.assetUrl}` : `素材已创建，当前状态：${statusLabel[asset.status]}`)
    closeUploadDialog()
  }

  const uploadFiles = async (files: File[]): Promise<void> => {
    if (!selectedUploadGroupId || selectedUploadGroupId <= 0) {
      onError('本地文件上传前必须选择一个自建素材库分组。')
      return
    }

    const uploadableFiles = files.filter(Boolean).slice(0, 20)
    if (uploadableFiles.length === 0) {
      return
    }

    setLocalUploadResult(undefined)
    setUploadStatus(`正在上传 ${uploadableFiles.length} 个文件到对象存储并创建 Seedance 素材...`)

    let lastResult: LocalFileUploadResult | undefined
    let successCount = 0
    for (const file of uploadableFiles) {
      const inferredType = getAssetTypeFromFile(file) ?? localAssetType

      setLocalAssetType(inferredType)
      const bytes = await file.arrayBuffer()
      const result = await api.uploadLocalAssetFile({
        groupId: selectedUploadGroupId,
        assetType: inferredType,
        name: localAssetName.trim() || file.name,
        fileName: file.name,
        mimeType: file.type || undefined,
        bytes
      })

      if (result.cancelled) {
        continue
      }

      lastResult = result
      if (result.errorMessage) {
        onError(`${result.errorMessage} 对象存储 URL 已保留，可复制后排查。`)
      }
      if (result.asset) {
        successCount += 1
      }
    }

    setLocalUploadResult(lastResult)
    if (lastResult?.asset) {
      setUploadStatus(lastResult.asset.status === 'Active' ? '素材已可用，可用于生成。' : `素材状态：${statusLabel[lastResult.asset.status]}`)
    } else if (lastResult?.storage) {
      setUploadStatus('对象存储已上传，但 Seedance 素材创建未完成。')
    } else {
      setUploadStatus('没有完成可用素材上传。')
    }

    setLocalAssetName('')
    setSelectedGroupId(selectedUploadGroupId)
    await onRefresh()
    await loadAssetsForGroup(selectedUploadGroupId)
    if (successCount > 0) {
      onToast(`${successCount} 个素材已上传到 Seedance 素材库。`)
      closeUploadDialog()
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragActive(false)
    void run(() => uploadFiles(Array.from(event.dataTransfer.files)))
  }

  const renameAsset = async (asset: AssetItem): Promise<void> => {
    const nextName = window.prompt('素材名称', asset.name)
    if (!nextName?.trim()) {
      return
    }

    await api.renameAsset(asset.id, nextName.trim())
    await onRefresh()
    await loadAssetsForGroup(selectedGroupId)
    onToast('素材已重命名。')
  }

  const deleteAsset = async (asset: AssetItem): Promise<void> => {
    if (!window.confirm(`确定删除素材“${asset.name}”吗？删除后可能不可恢复。`)) {
      return
    }

    await api.deleteAsset(asset.id)
    await onRefresh()
    await loadAssetsForGroup(selectedGroupId)
    onToast('素材已删除。')
  }

  const renderAssetPreview = (asset: AssetItem): JSX.Element => {
    if (asset.assetType === 'Image' && asset.url) {
      return <img alt={asset.name} className="asset-thumb" src={asset.url} />
    }
    if (asset.assetType === 'Video' && asset.url) {
      return (
        <>
          {/* biome-ignore lint/a11y/useMediaCaption: Uploaded API reference assets do not provide caption tracks. */}
          <video className="asset-thumb" controls preload="metadata" src={asset.url} />
        </>
      )
    }
    if (asset.assetType === 'Audio' && asset.url) {
      return (
        <div className="asset-thumb asset-thumb-audio">
          <FileAudio size={26} />
          {/* biome-ignore lint/a11y/useMediaCaption: Uploaded API reference assets do not provide caption tracks. */}
          <audio controls src={asset.url} />
        </div>
      )
    }

    return <div className="asset-thumb asset-thumb-file">{getAssetIcon(asset.assetType)}</div>
  }

  return (
    <div className="asset-library-layout asset-library-compact">
      <aside className="panel group-sidebar compact-group-sidebar">
        <div className="panel-heading">
          <h2>素材分组</h2>
          <button className="icon-button" disabled={busy || loadingAssets} onClick={() => void run(refreshAll)} title="刷新素材库" type="button">
            <RefreshCw size={15} />
          </button>
        </div>
        <div className="new-group-row compact-new-group">
          <input
            onChange={(event) => setNewGroupName(event.target.value)}
            placeholder="新建分组"
            value={newGroupName}
          />
          <button className="icon-button" disabled={busy} onClick={() => void run(createGroup)} title="创建分组" type="button">
            <Plus size={15} />
          </button>
        </div>
        <div className="group-list compact-group-list">
          <button
            aria-pressed={selectedGroupId === undefined}
            className="group-button"
            onClick={() => selectGroup(undefined)}
            type="button"
          >
            <span>全部素材</span>
            <strong>{assets.length}</strong>
          </button>
          {groups.map((group) => (
            <div className="group-row compact-group-row" key={group.id}>
              <button
                aria-pressed={selectedGroupId === group.id}
                className="group-button"
                onClick={() => selectGroup(group.id)}
                type="button"
              >
                <span>{group.id === -2 ? '历史分组' : group.name}</span>
                <strong>{group.assetCount ?? 0}</strong>
              </button>
              {group.id > 0 ? (
                <button
                  className="icon-button danger-icon"
                  disabled={busy}
                  onClick={() => void run(() => deleteGroup(group))}
                  title="删除分组"
                  type="button"
                >
                  <Trash2 size={13} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </aside>

      <section className="panel asset-main compact-asset-main">
        <div className="asset-page-header">
          <div>
            <h2>Seedance 素材库</h2>
            <span>上传后获得 asset://，素材可用后即可用于视频生成。</span>
          </div>
          <div className="asset-upload-actions">
            <button className="secondary-button" disabled={busy} onClick={() => openUploadDialog('url')} type="button">
              <ExternalLink size={15} />
              <span>公网 URL</span>
            </button>
            <button className="primary-button" disabled={busy} onClick={() => openUploadDialog('local')} type="button">
              <UploadCloud size={15} />
              <span>本地上传</span>
            </button>
          </div>
        </div>

        <p className="notice asset-notice">
          带人脸素材需要通过素材库 API 处理/审核后，才能作为 Seedance 参考素材使用。生成视频时只使用 asset:// 地址。
        </p>

        <div className="asset-toolbar compact-asset-toolbar">
          <div className="asset-search-box">
            <Search size={15} />
            <input
              onChange={(event) => setAssetSearch(event.target.value)}
              placeholder="搜索名称、asset:// 或公网 URL"
              value={assetSearch}
            />
          </div>
          <SelectMenu
            className="asset-filter-select"
            onChange={(value) => setTypeFilter(value as AssetType | 'All')}
            options={[{ value: 'All', label: '全部类型' }, ...assetTypes.map((type) => ({ value: type, label: typeLabel[type] }))]}
            value={typeFilter}
          />
          <SelectMenu
            className="asset-filter-select"
            onChange={(value) => setStatusFilter(value as AssetStatus | 'All')}
            options={[{ value: 'All', label: '全部状态' }, ...assetStatuses.map((status) => ({ value: status, label: statusLabel[status] }))]}
            value={statusFilter}
          />
          <button className="secondary-button" disabled={busy || loadingAssets} onClick={() => void loadAssetsForGroup()} type="button">
            <RefreshCw size={15} />
            <span>刷新</span>
          </button>
        </div>

        <div className={filteredAssets.length === 0 ? 'asset-grid compact-asset-grid asset-grid-empty' : 'asset-grid compact-asset-grid'}>
          {filteredAssets.length === 0 ? (
            <div className="asset-empty-state">
              <ImagePlus size={34} />
              <strong>{loadingAssets ? '正在加载素材...' : '还没有素材'}</strong>
              <span>点击右上角“公网 URL”或“本地上传”，本地上传弹窗支持直接拖拽图片、视频或音频。</span>
            </div>
          ) : (
            filteredAssets.map((asset) => (
              <article className="asset-card compact-asset-card" key={asset.id}>
                <div className="asset-preview-frame">
                  {renderAssetPreview(asset)}
                  <div className="asset-card-badges">
                    <span className={`asset-type asset-${asset.assetType.toLowerCase()}`}>{typeLabel[asset.assetType]}</span>
                    <span className={`asset-state asset-state-${asset.status.toLowerCase()}`}>{statusLabel[asset.status]}</span>
                  </div>
                </div>
                <div className="asset-card-meta">
                  <strong title={asset.name}>{asset.name}</strong>
                  <button className="asset-url-button" onClick={() => void onCopy(asset.assetUrl, 'asset:// 已复制。')} title="复制 asset://" type="button">
                    {asset.assetUrl}
                  </button>
                  <small>{formatDate(asset.createdAt)}</small>
                </div>
                <div className="row-actions asset-card-actions">
                  <button className="icon-button" onClick={() => void onCopy(asset.assetUrl, 'asset:// 已复制。')} title="复制 asset://" type="button">
                    <Copy size={14} />
                  </button>
                  <button className="icon-button" onClick={() => void run(() => renameAsset(asset))} title="重命名" type="button">
                    <Pencil size={14} />
                  </button>
                  <button className="icon-button danger-icon" onClick={() => void run(() => deleteAsset(asset))} title="删除素材" type="button">
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {uploadDialog ? (
        <div className="asset-upload-modal-backdrop" onClick={closeUploadDialog} role="presentation">
          <div className="asset-upload-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <header>
              <div>
                <strong>{uploadDialog === 'url' ? '公网 URL 上传' : '本地文件上传'}</strong>
                <span>{uploadDialog === 'url' ? '创建 Seedance 素材' : '拖入文件后自动上传到对象存储并创建素材'}</span>
              </div>
              <button className="icon-button" onClick={closeUploadDialog} title="关闭" type="button">
                <X size={16} />
              </button>
            </header>

            {uploadStatus ? <div className="upload-status-line">{uploadStatus}</div> : null}

            <label className="field">
              <span>素材分组</span>
              <SelectMenu
                onChange={(value) => setSelectedUploadGroupId(Number(value))}
                options={[
                  { value: '', label: '先创建一个自建分组', disabled: true },
                  ...uploadableGroups.map((group) => ({ value: String(group.id), label: group.name }))
                ]}
                value={selectedUploadGroupId ? String(selectedUploadGroupId) : ''}
              />
            </label>

            {uploadDialog === 'url' ? (
              <>
                <label className="field">
                  <span>公网素材 URL</span>
                  <input
                    onChange={(event) => setAssetUrl(event.target.value)}
                    placeholder="https://example.com/reference.jpg"
                    value={assetUrl}
                  />
                </label>
                <div className="asset-modal-row">
                  <label className="field">
                    <span>素材名称</span>
                    <input onChange={(event) => setAssetName(event.target.value)} placeholder="留空则使用文件名" value={assetName} />
                  </label>
                  <label className="field">
                    <span>素材类型</span>
                    <SelectMenu
                      onChange={(value) => setAssetType(value as AssetType)}
                      options={assetTypes.map((type) => ({ value: type, label: typeLabel[type] }))}
                      value={assetType}
                    />
                  </label>
                </div>
                <button className="primary-button full-width-button" disabled={busy} onClick={() => void run(createAsset)} type="button">
                  <UploadCloud size={16} />
                  <span>{busy ? '处理中...' : '创建素材并等待可用'}</span>
                </button>
              </>
            ) : (
              <>
                <div className="asset-modal-row">
                  <label className="field">
                    <span>素材名称</span>
                    <input
                      onChange={(event) => setLocalAssetName(event.target.value)}
                      placeholder="留空则使用文件名"
                      value={localAssetName}
                    />
                  </label>
                  <label className="field">
                    <span>默认类型</span>
                    <SelectMenu
                      onChange={(value) => setLocalAssetType(value as AssetType)}
                      options={assetTypes.map((type) => ({ value: type, label: typeLabel[type] }))}
                      value={localAssetType}
                    />
                  </label>
                </div>
                <input
                  accept="image/*,video/*,audio/*"
                  multiple
                  onChange={(event) => void run(() => uploadFiles(Array.from(event.target.files ?? [])))}
                  ref={fileInputRef}
                  type="file"
                  hidden
                />
                <div
                  className={dragActive ? 'asset-drop-zone asset-drop-zone-active' : 'asset-drop-zone'}
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    setDragActive(false)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <UploadCloud size={30} />
                  <strong>拖入图片、视频或音频</strong>
                  <span>也可以点击选择文件。上传后会自动创建 Seedance 素材，生成时使用 asset://。</span>
                </div>
                {localUploadResult?.storage ? (
                  <div className="local-upload-result">
                    <span>对象存储 URL</span>
                    <button
                      className="link-button"
                      onClick={() => void onCopy(localUploadResult.storage?.publicUrl ?? '', '公网 URL 已复制。')}
                      type="button"
                    >
                      {localUploadResult.storage.publicUrl}
                    </button>
                    {localUploadResult.asset ? (
                      <>
                        <span>asset:// 地址</span>
                        <button
                          className="link-button"
                          onClick={() => void onCopy(localUploadResult.asset?.assetUrl ?? '', 'asset:// 已复制。')}
                          type="button"
                        >
                          {localUploadResult.asset.assetUrl}
                        </button>
                        <small>状态：{statusLabel[localUploadResult.asset.status]}</small>
                      </>
                    ) : (
                      <small>{localUploadResult.errorMessage ?? '已上传到对象存储，Seedance 素材创建尚未完成。'}</small>
                    )}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
