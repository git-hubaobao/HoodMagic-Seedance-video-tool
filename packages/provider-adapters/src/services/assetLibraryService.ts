import {
  type AssetGroup,
  type AssetItem,
  type AssetListRequest,
  type AssetListResult,
  type AssetStatus,
  type CreateAssetRequest,
  type LocalAssetUploadPlan,
  validateAssetSourceUrl,
  type VideoProviderConfig
} from '@hoodmagic/video-core'

import { asRecord, authHeaders, getFetch, joinUrl, requestJson, stringValue, type FetchLike } from '../common'

const normalizeAssetStatus = (status: unknown): AssetStatus => {
  const value = typeof status === 'string' ? status.toLowerCase() : ''
  if (value === 'active') {
    return 'Active'
  }

  if (value === 'failed') {
    return 'Failed'
  }

  if (value === 'processing' || value === 'pending' || value === 'created') {
    return 'Processing'
  }

  return 'Unknown'
}

const normalizeAssetUrl = (assetUrl: string | undefined, id: string | undefined): string => {
  const fallback = `asset://${id ?? 'unknown-asset'}`
  return (assetUrl ?? fallback).replace(/^asset:\/\//i, 'asset://')
}

const mapAssetGroup = (value: unknown): AssetGroup => {
  const record = asRecord(value)
  const groupName = stringValue(record.group_name)
  return {
    id: Number(record.id ?? 0),
    name: stringValue(record.name) ?? groupName ?? 'Untitled group',
    ...(groupName !== undefined ? { groupName } : {}),
    ...(typeof record.is_default === 'boolean' ? { isDefault: record.is_default } : {}),
    ...(typeof record.asset_count === 'number' ? { assetCount: record.asset_count } : {})
  }
}

const mapAssetItem = (value: unknown): AssetItem => {
  const record = asRecord(value)
  const url = stringValue(record.url)
  const createdAt = stringValue(record.create_time)
  const updatedAt = stringValue(record.update_time)
  return {
    id: stringValue(record.id) ?? 'unknown-asset',
    name: stringValue(record.name) ?? 'Untitled asset',
    assetUrl: normalizeAssetUrl(stringValue(record.asset_url), stringValue(record.id)),
    assetType: record.asset_type === 'Video' || record.asset_type === 'Audio' ? record.asset_type : 'Image',
    status: normalizeAssetStatus(record.status),
    ...(url !== undefined ? { url } : {}),
    ...(typeof record.group_id === 'number' ? { groupId: record.group_id } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {})
  }
}

export class AssetLibraryService {
  private readonly fetchLike: FetchLike

  constructor(fetchLike?: FetchLike) {
    this.fetchLike = getFetch(fetchLike)
  }

  async listGroups(config: VideoProviderConfig): Promise<AssetGroup[]> {
    const body = await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/groups'),
      {
        method: 'GET',
        headers: authHeaders(config.apiKey)
      },
      'asset_groups_failed'
    )
    const groups = asRecord(body).data
    return Array.isArray(groups) ? groups.map(mapAssetGroup) : []
  }

  async createGroup(config: VideoProviderConfig, name: string): Promise<AssetGroup> {
    await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/groups'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({ name })
      },
      'asset_group_create_failed'
    )
    const groups = await this.listGroups(config)
    return groups.find((group) => group.name === name || group.groupName?.endsWith(name)) ?? groups[0] ?? { id: 0, name }
  }

  async deleteGroup(config: VideoProviderConfig, id: number): Promise<void> {
    await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/groups/delete'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({ id })
      },
      'asset_group_delete_failed'
    )
  }

  async transferGroup(config: VideoProviderConfig, id: number, tokenId: number): Promise<void> {
    await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/groups/transfer'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({ id, token_id: tokenId })
      },
      'asset_group_transfer_failed'
    )
  }

  async createAsset(config: VideoProviderConfig, request: CreateAssetRequest): Promise<AssetItem> {
    const urlValidation = validateAssetSourceUrl(request.url)
    if (!urlValidation.ok) {
      throw new Error(urlValidation.issues[0]?.message ?? 'Invalid asset URL.')
    }

    if (request.groupId <= 0) {
      throw new Error('Asset creation requires a group_id greater than 0.')
    }

    const body = await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({
          url: request.url,
          asset_type: request.assetType,
          name: request.name,
          group_id: request.groupId
        })
      },
      'asset_create_failed'
    )
    const data = asRecord(asRecord(body).data)

    return {
      id: stringValue(data.id) ?? 'unknown-asset',
      name: request.name,
      assetUrl: normalizeAssetUrl(stringValue(data.asset_url), stringValue(data.id)),
      assetType: request.assetType,
      status: 'Processing',
      groupId: request.groupId
    }
  }

  async listAssets(config: VideoProviderConfig, request: AssetListRequest = {}): Promise<AssetListResult> {
    const body = await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/list'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({
          page_number: request.pageNumber ?? 1,
          page_size: request.pageSize ?? 30,
          ...(request.groupId !== undefined ? { group_id: request.groupId } : {})
        })
      },
      'asset_list_failed'
    )
    const data = asRecord(asRecord(body).data)
    const items = Array.isArray(data.items) ? data.items.map(mapAssetItem) : []

    return {
      items,
      totalCount: typeof data.total_count === 'number' ? data.total_count : items.length,
      pageNumber: typeof data.page_number === 'number' ? data.page_number : (request.pageNumber ?? 1),
      pageSize: typeof data.page_size === 'number' ? data.page_size : (request.pageSize ?? 30)
    }
  }

  async getAsset(config: VideoProviderConfig, id: string): Promise<AssetItem> {
    const body = await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/get'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({ id })
      },
      'asset_get_failed'
    )

    return mapAssetItem(asRecord(body).data)
  }

  async renameAsset(config: VideoProviderConfig, id: string, name: string): Promise<void> {
    await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/update'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({ id, name })
      },
      'asset_update_failed'
    )
  }

  async deleteAsset(config: VideoProviderConfig, id: string): Promise<void> {
    await requestJson(
      this.fetchLike,
      joinUrl(config.baseUrl, '/v1/assets/delete'),
      {
        method: 'POST',
        headers: authHeaders(config.apiKey),
        body: JSON.stringify({ id })
      },
      'asset_delete_failed'
    )
  }

  planLocalFileUpload(): LocalAssetUploadPlan {
    return {
      ok: false,
      code: 'local_file_requires_public_url',
      message: 'Local file upload is reserved for a future object-storage bridge. Use a public URL for now.'
    }
  }
}
