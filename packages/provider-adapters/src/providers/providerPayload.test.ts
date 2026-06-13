import { describe, expect, it, vi } from 'vitest'

import { normalizeVideoTaskStatus, type VideoGenerationRequest } from '@hoodmagic/video-core'

import { buildHoodMagicVideoRequestBody, mapHoodMagicTaskResponse } from './hoodmagicVideoProvider'
import { createMockVideoProvider } from './mockVideoProvider'
import { buildVolcengineSeedanceRequestBody, createVolcengineSeedanceProvider, mapVolcengineTaskResponse } from './volcengineSeedanceProvider'

const request: VideoGenerationRequest = {
  provider: 'hoodmagic',
  model: 'doubao-seedance-2-0-fast-260128',
  prompt: 'Make the sunflower sway in the wind.',
  mode: 'reference',
  content: [
    { type: 'text', text: 'Make the sunflower sway in the wind.' },
    {
      type: 'image_url',
      image_url: { url: 'asset://asset-20260403150605-bfjwz' },
      role: 'reference_image'
    }
  ],
  resolution: '720p',
  ratio: 'adaptive',
  duration: 5,
  generateAudio: true,
  seed: 11,
  watermark: false,
  tools: [{ type: 'web_search' }]
}

describe('provider payload builders', () => {
  it('builds HoodMagic metadata request bodies with asset URLs', () => {
    expect(buildHoodMagicVideoRequestBody(request)).toMatchObject({
      model: 'doubao-seedance-2-0-fast-260128',
      prompt: 'Make the sunflower sway in the wind.',
      metadata: {
        duration: 5,
        resolution: '720p',
        ratio: 'adaptive',
        generate_audio: true,
        seed: 11,
        watermark: false,
        content: [
          { type: 'text', text: 'Make the sunflower sway in the wind.' },
          {
            type: 'image_url',
            image_url: { url: 'asset://asset-20260403150605-bfjwz' },
            role: 'reference_image'
          }
        ]
      }
    })
  })

  it('builds Volcengine top-level request bodies', () => {
    expect(buildVolcengineSeedanceRequestBody({ ...request, provider: 'volcengine' })).toMatchObject({
      model: 'doubao-seedance-2-0-fast-260128',
      duration: 5,
      resolution: '720p',
      ratio: 'adaptive',
      generate_audio: true,
      seed: 11,
      watermark: false,
      content: [
        { type: 'text', text: 'Make the sunflower sway in the wind.' },
        {
          type: 'image_url',
          image_url: { url: 'asset://asset-20260403150605-bfjwz' },
          role: 'reference_image'
        }
      ]
    })
  })
})

describe('status mapping', () => {
  it('maps provider statuses into internal statuses', () => {
    expect(normalizeVideoTaskStatus('IN_PROGRESS')).toBe('running')
    expect(normalizeVideoTaskStatus('SUCCESS')).toBe('succeeded')
    expect(normalizeVideoTaskStatus('queued')).toBe('queued')
    expect(normalizeVideoTaskStatus('expired')).toBe('expired')
  })
})

describe('mock provider', () => {
  it('creates and completes a task without an API key', async () => {
    const provider = createMockVideoProvider()
    const config = {
      provider: 'hoodmagic' as const,
      baseUrl: 'https://example.com',
      apiKey: '',
      defaultModel: request.model,
      defaultResolution: '720p' as const,
      defaultRatio: 'adaptive' as const,
      defaultDuration: 5,
      generateAudio: false,
      enableWebSearch: false,
      models: []
    }

    const created = await provider.createTask(request, config)
    const running = await provider.getTask(created.id, config, created)
    const done = await provider.getTask(created.id, config, running)

    expect(created.status).toBe('queued')
    expect(running.status).toBe('running')
    expect(done.status).toBe('succeeded')
    expect(done.videoUrl).toContain('.mp4')
  })
})

describe('Volcengine provider', () => {
  it('posts to the official tasks endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'cgt-official-1', status: 'queued' })))
    const provider = createVolcengineSeedanceProvider(fetchMock)
    const config = {
      provider: 'volcengine' as const,
      baseUrl: 'https://ark.cn-beijing.volces.com',
      apiKey: 'test-key',
      defaultModel: request.model,
      defaultResolution: '720p' as const,
      defaultRatio: 'adaptive' as const,
      defaultDuration: 5,
      generateAudio: false,
      enableWebSearch: false,
      models: []
    }

    const task = await provider.createTask({ ...request, provider: 'volcengine' }, config)

    expect(task.id).toBe('cgt-official-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('video URL mapping', () => {
  it('extracts HoodMagic video URLs from alternate response shapes', () => {
    const task = mapHoodMagicTaskResponse(
      {
        data: {
          status: 'SUCCESS',
          data: {
            content: {
              output: {
                video_url: 'https://example.com/hoodmagic-alt.mp4'
              }
            }
          }
        }
      },
      {
        id: 'hm-alt',
        provider: 'hoodmagic',
        status: 'running',
        model: request.model,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    )

    expect(task.videoUrl).toBe('https://example.com/hoodmagic-alt.mp4')
  })

  it('extracts Volcengine video URLs from output/result wrappers', () => {
    const task = mapVolcengineTaskResponse(
      {
        id: 've-alt',
        status: 'SUCCESS',
        result: {
          videoUrl: 'https://example.com/volcengine-alt.mp4'
        }
      },
      {
        id: 've-alt',
        provider: 'volcengine',
        status: 'running',
        model: request.model,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    )

    expect(task.videoUrl).toBe('https://example.com/volcengine-alt.mp4')
  })
})
