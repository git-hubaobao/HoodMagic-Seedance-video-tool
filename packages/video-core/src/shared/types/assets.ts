export type AssetType = 'Image' | 'Video' | 'Audio'

export type AssetStatus = 'Processing' | 'Active' | 'Failed' | 'Unknown'

export type AssetSourceType = 'remote' | 'local_file'

export type AssetGroup = {
  id: number
  name: string
  groupName?: string
  isDefault?: boolean
  assetCount?: number
}

export type AssetItem = {
  id: string
  name: string
  url?: string
  assetUrl: string
  assetType: AssetType
  status: AssetStatus
  groupId?: number
  createdAt?: string
  updatedAt?: string
  error?: string
  sourceType?: AssetSourceType
  localFilePath?: string
  fileName?: string
  mimeType?: string
  sizeBytes?: number
  importedAt?: string
}

export type AssetListRequest = {
  groupId?: number
  pageNumber?: number
  pageSize?: number
}

export type AssetListResult = {
  items: AssetItem[]
  totalCount: number
  pageNumber: number
  pageSize: number
}

export type CreateAssetRequest = {
  url: string
  assetType: AssetType
  name: string
  groupId: number
}

export type ImportLocalAssetsRequest = {
  groupId?: number
  assetType?: AssetType
  allowMultiple?: boolean
}

export type LocalAssetImportResult = {
  cancelled: boolean
  items: AssetItem[]
}

export type LocalAssetUploadPlan =
  | {
      ok: true
    }
  | {
      ok: false
      code: 'local_file_requires_public_url'
      message: string
    }
