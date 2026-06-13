import { describe, expect, it, vi } from 'vitest'

import type { VideoProviderConfig } from '@hoodmagic/video-core'

import { AssetLibraryService } from './assetLibraryService'

const config: VideoProviderConfig = {
  provider: 'hoodmagic',
  baseUrl: 'https://api.example.com',
  apiKey: 'sk-test',
  defaultModel: 'doubao-seedance-2-0-fast-260128',
  defaultResolution: '720p',
  defaultRatio: 'adaptive',
  defaultDuration: 5,
  generateAudio: false,
  enableWebSearch: false,
  models: []
}

describe('AssetLibraryService', () => {
  it('creates assets with the documented Seedance asset payload', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ code: 'success', data: { id: 'asset-1', asset_url: 'Asset://asset-1' } }))
    )
    const service = new AssetLibraryService(fetchMock)

    const asset = await service.createAsset(config, {
      url: 'https://example.com/reference.jpg',
      assetType: 'Image',
      name: 'reference',
      groupId: 8
    })

    expect(asset.assetUrl).toBe('asset://asset-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/assets',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json; charset=utf-8'
        }),
        body: JSON.stringify({
          url: 'https://example.com/reference.jpg',
          asset_type: 'Image',
          name: 'reference',
          group_id: 8
        })
      })
    )
  })

  it('refuses local asset URLs before calling the API', async () => {
    const fetchMock = vi.fn()
    const service = new AssetLibraryService(fetchMock)

    await expect(
      service.createAsset(config, {
        url: 'file:///C:/reference.jpg',
        assetType: 'Image',
        name: 'local-file',
        groupId: 8
      })
    ).rejects.toThrow('public http(s) URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
