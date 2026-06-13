import type { VideoModelConfig, VideoProviderType } from './shared/types/videoGeneration'

export const builtInVideoModels: VideoModelConfig[] = [
  {
    id: 'doubao-seedance-2-0-260128',
    label: 'Doubao Seedance 2.0',
    provider: 'both',
    supports1080p: true,
    supportsWebSearch: true,
    supportsReturnLastFrame: true,
    durationMin: 4,
    durationMax: 15,
    allowSmartDuration: true
  },
  {
    id: 'doubao-seedance-2-0-fast-260128',
    label: 'Doubao Seedance 2.0 Fast',
    provider: 'both',
    supports1080p: false,
    supportsWebSearch: true,
    supportsReturnLastFrame: true,
    durationMin: 4,
    durationMax: 15,
    allowSmartDuration: true
  }
]

export const getVideoModelsForProvider = (
  models: readonly VideoModelConfig[] = builtInVideoModels,
  provider?: VideoProviderType
): VideoModelConfig[] => {
  if (!provider) {
    return [...models]
  }

  return models.filter((model) => model.provider === 'both' || model.provider === provider)
}

export const resolveVideoModelConfig = (
  modelId: string,
  models: readonly VideoModelConfig[] = builtInVideoModels
): VideoModelConfig => {
  return (
    models.find((model) => model.id === modelId) ?? {
      id: modelId,
      label: modelId,
      provider: 'both',
      supports1080p: !modelId.includes('fast'),
      supportsWebSearch: /seedance-2-0/i.test(modelId),
      supportsReturnLastFrame: /seedance-2-0/i.test(modelId),
      durationMin: /seedance-2-0/i.test(modelId) ? 4 : 2,
      durationMax: /seedance-2-0/i.test(modelId) ? 15 : 12,
      allowSmartDuration: /seedance-2-0/i.test(modelId)
    }
  )
}
