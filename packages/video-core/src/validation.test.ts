import { describe, expect, it } from 'vitest'

import { validateAssetSourceUrl, validateVideoGenerationRequest } from './validation'
import type { VideoGenerationRequest } from './shared/types/videoGeneration'

const baseRequest: VideoGenerationRequest = {
  provider: 'volcengine',
  model: 'doubao-seedance-2-0-260128',
  prompt: 'A camera glides through a neon street.',
  mode: 'text_only',
  content: [{ type: 'text', text: 'A camera glides through a neon street.' }],
  resolution: '720p',
  ratio: '16:9',
  duration: 5,
  generateAudio: false
}

describe('validateVideoGenerationRequest', () => {
  it('accepts a text-only request', () => {
    expect(validateVideoGenerationRequest(baseRequest)).toEqual({ ok: true })
  })

  it('rejects 1080p on fast model', () => {
    const result = validateVideoGenerationRequest({
      ...baseRequest,
      model: 'doubao-seedance-2-0-fast-260128',
      resolution: '1080p'
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.issues.map((issue) => issue.code)).toContain('resolution_not_supported')
  })

  it('rejects audio-only reference mode', () => {
    const result = validateVideoGenerationRequest({
      ...baseRequest,
      mode: 'reference',
      content: [
        { type: 'text', text: 'Use the beat.' },
        { type: 'audio_url', audio_url: { url: 'asset://asset-audio' }, role: 'reference_audio' }
      ]
    })

    expect(result.ok).toBe(false)
    expect(result.ok ? [] : result.issues.map((issue) => issue.code)).toContain('reference_media_required')
  })
})

describe('validateAssetSourceUrl', () => {
  it('accepts public http URLs and rejects local URLs', () => {
    expect(validateAssetSourceUrl('https://example.com/reference.jpg')).toEqual({ ok: true })
    expect(validateAssetSourceUrl('file:///C:/reference.jpg').ok).toBe(false)
    expect(validateAssetSourceUrl('http://localhost/reference.jpg').ok).toBe(false)
    expect(validateAssetSourceUrl('http://192.168.1.10/reference.jpg').ok).toBe(false)
  })
})
