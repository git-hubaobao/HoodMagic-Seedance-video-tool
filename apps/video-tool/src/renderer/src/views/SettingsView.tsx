import { CheckCircle2, Plus, Save, Trash2 } from 'lucide-react'
import type { JSX } from 'react'
import { useMemo, useState } from 'react'

import type { VideoModelConfig, VideoProviderType, VideoRatio, VideoResolution } from '@hoodmagic/video-core'
import type { VideoToolSettings } from '@hoodmagic/storage'

import type { VideoToolApi } from '../../../shared/video'
import { SelectMenu } from '../components/SelectMenu'
import { ObjectStorageSettings } from '../components/settings/ObjectStorageSettings'

type SettingsViewProps = {
  api: VideoToolApi
  settings: VideoToolSettings
  onSave: (settings: VideoToolSettings) => Promise<void>
  onObjectStorageSaved: (objectStorage: VideoToolSettings['objectStorage']) => void
  onToast: (message: string) => void
  onError: (message: string) => void
}

const providers: VideoProviderType[] = ['hoodmagic', 'volcengine']
const resolutions: VideoResolution[] = ['480p', '720p', '1080p']
const ratios: VideoRatio[] = ['adaptive', '16:9', '9:16', '1:1', '4:3', '3:4', '21:9']
type SettingsSection = 'api' | 'models' | 'storage'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const providerLabel = (provider: VideoProviderType): string => {
  if (provider === 'volcengine') {
    return '火山引擎官方'
  }

  return '自定义服务商'
}

const cloneSettings = (settings: VideoToolSettings): VideoToolSettings => JSON.parse(JSON.stringify(settings)) as VideoToolSettings

const createModel = (id: string, provider: VideoProviderType): VideoModelConfig => ({
  id,
  label: id,
  provider,
  supports1080p: !id.includes('fast'),
  supportsWebSearch: /seedance-2-0/i.test(id),
  supportsReturnLastFrame: /seedance-2-0/i.test(id),
  durationMin: /seedance-2-0/i.test(id) ? 4 : 2,
  durationMax: /seedance-2-0/i.test(id) ? 15 : 12,
  allowSmartDuration: /seedance-2-0/i.test(id)
})

export function SettingsView({ api, settings, onSave, onObjectStorageSaved, onToast, onError }: SettingsViewProps): JSX.Element {
  const [draft, setDraft] = useState<VideoToolSettings>(() => cloneSettings(settings))
  const [selectedProvider, setSelectedProvider] = useState<VideoProviderType>(settings.activeProvider)
  const [selectedSection, setSelectedSection] = useState<SettingsSection>('api')
  const [newModelId, setNewModelId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const providerConfig = draft.providers[selectedProvider]
  const activeModelIds = useMemo(() => new Set(providerConfig.models.map((model) => model.id)), [providerConfig.models])

  const updateProviderConfig = (patch: Partial<typeof providerConfig>): void => {
    setDraft((current) => ({
      ...current,
      providers: {
        ...current.providers,
        [selectedProvider]: {
          ...current.providers[selectedProvider],
          ...patch
        }
      }
    }))
  }

  const updateModel = (modelId: string, patch: Partial<VideoModelConfig>): void => {
    updateProviderConfig({
      models: providerConfig.models.map((model) => (model.id === modelId ? { ...model, ...patch } : model))
    })
  }

  const addModel = (): void => {
    const id = newModelId.trim()
    if (!id || activeModelIds.has(id)) {
      return
    }

    updateProviderConfig({
      models: [...providerConfig.models, createModel(id, selectedProvider)]
    })
    setNewModelId('')
  }

  const removeModel = (modelId: string): void => {
    const nextModels = providerConfig.models.filter((model) => model.id !== modelId)
    updateProviderConfig({
      models: nextModels,
      defaultModel: providerConfig.defaultModel === modelId ? (nextModels[0]?.id ?? '') : providerConfig.defaultModel
    })
  }

  const save = async (): Promise<void> => {
    setSaving(true)
    setSaveState('saving')
    try {
      await onSave(draft)
      setSaveState('saved')
      window.setTimeout(() => setSaveState('idle'), 1800)
    } catch (error) {
      setSaveState('error')
      onError(error instanceof Error ? error.message : '设置保存失败。')
      window.setTimeout(() => setSaveState('idle'), 2200)
    } finally {
      setSaving(false)
    }
  }

  const saveButtonLabel = saveState === 'saving' ? '保存中...' : saveState === 'saved' ? '已保存' : '保存设置'
  const saveButtonClassName =
    saveState === 'saved'
      ? 'primary-button compact-primary settings-save-button save-button-saved'
      : saveState === 'error'
        ? 'primary-button compact-primary settings-save-button save-button-error'
        : 'primary-button compact-primary settings-save-button'

  return (
    <div className="settings-layout settings-hub">
      <aside className="settings-nav">
        <button aria-pressed={selectedSection === 'api'} onClick={() => setSelectedSection('api')} type="button">
          {'\u914d\u7f6e\u8bbe\u7f6e'}
        </button>
        <button aria-pressed={selectedSection === 'models'} onClick={() => setSelectedSection('models')} type="button">
          模型管理
        </button>
        <button aria-pressed={selectedSection === 'storage'} onClick={() => setSelectedSection('storage')} type="button">
          对象存储
        </button>
      </aside>

      <div className="settings-content">
        {selectedSection === 'api' ? (
      <section className="panel settings-panel">
        <div className="panel-heading settings-panel-heading">
          <h2>API 服务商</h2>
          <button className={saveButtonClassName} disabled={saving} onClick={() => void save()} type="button">
            {saveState === 'saved' ? <CheckCircle2 size={15} /> : <Save size={15} />}
            <span>{saveButtonLabel}</span>
          </button>
        </div>
        <div className="settings-save-feedback" aria-live="polite">
          {saveState === 'saved' ? '设置已保存到本地。' : saveState === 'error' ? '保存失败，请检查错误提示。' : '修改后点击右上角保存。'}
        </div>
        <div className="provider-tabs">
          {providers.map((provider) => (
            <button
              aria-pressed={selectedProvider === provider}
              key={provider}
              onClick={() => {
                setSelectedProvider(provider)
                setDraft((current) => ({ ...current, activeProvider: provider }))
              }}
              type="button"
            >
              {providerLabel(provider)}
            </button>
          ))}
        </div>
        <div className="settings-form-grid">
          <label className="field">
            <span>baseUrl</span>
            <input
              onChange={(event) => updateProviderConfig({ baseUrl: event.target.value })}
              value={providerConfig.baseUrl}
            />
          </label>
          <label className="field">
            <span>apiKey</span>
            <input
              onChange={(event) => updateProviderConfig({ apiKey: event.target.value })}
              placeholder="sk-..."
              type="password"
              value={providerConfig.apiKey}
            />
          </label>
          <label className="field">
            <span>默认模型</span>
            <SelectMenu
              onChange={(value) => updateProviderConfig({ defaultModel: value })}
              options={providerConfig.models.map((model) => ({ value: model.id, label: model.label ?? model.id }))}
              value={providerConfig.defaultModel}
            />
          </label>
          <label className="field">
            <span>默认分辨率</span>
            <SelectMenu
              onChange={(value) => updateProviderConfig({ defaultResolution: value as VideoResolution })}
              options={resolutions.map((resolution) => ({ value: resolution, label: resolution }))}
              value={providerConfig.defaultResolution}
            />
          </label>
          <label className="field">
            <span>默认比例</span>
            <SelectMenu
              onChange={(value) => updateProviderConfig({ defaultRatio: value as VideoRatio })}
              options={ratios.map((ratio) => ({ value: ratio, label: ratio }))}
              value={providerConfig.defaultRatio}
            />
          </label>
          <label className="field">
            <span>默认时长</span>
            <input
              onChange={(event) => updateProviderConfig({ defaultDuration: Number(event.target.value) })}
              type="number"
              value={providerConfig.defaultDuration}
            />
          </label>
          <label className="field">
            <span>下载目录</span>
            <input
              onChange={(event) => updateProviderConfig({ downloadDirectory: event.target.value })}
              placeholder="留空使用应用数据目录"
              value={providerConfig.downloadDirectory ?? ''}
            />
          </label>
          <div className="toggle-row span-all">
            <label>
              <input
                checked={providerConfig.generateAudio}
                onChange={(event) => updateProviderConfig({ generateAudio: event.target.checked })}
                type="checkbox"
              />
              <span>默认 generate_audio</span>
            </label>
            <label>
              <input
                checked={providerConfig.enableWebSearch}
                onChange={(event) => updateProviderConfig({ enableWebSearch: event.target.checked })}
                type="checkbox"
              />
              <span>默认 web_search</span>
            </label>
          </div>
        </div>
      </section>
        ) : null}

        {selectedSection === 'models' ? (
      <section className="panel settings-panel">
        <div className="panel-heading settings-panel-heading">
          <h2>模型管理</h2>
          <div className="settings-heading-actions">
            <span>{providerConfig.models.length} 个模型</span>
            <button className={saveButtonClassName} disabled={saving} onClick={() => void save()} type="button">
              {saveState === 'saved' ? <CheckCircle2 size={15} /> : <Save size={15} />}
              <span>{saveButtonLabel}</span>
            </button>
          </div>
        </div>
        <div className="settings-save-feedback" aria-live="polite">
          {saveState === 'saved' ? '模型配置已保存。' : saveState === 'error' ? '保存失败，请检查错误提示。' : '新增、删除或修改模型后记得保存。'}
        </div>
        <div className="new-model-row">
          <input onChange={(event) => setNewModelId(event.target.value)} placeholder="模型 ID" value={newModelId} />
          <button className="icon-button" onClick={addModel} title="添加模型" type="button">
            <Plus size={15} />
          </button>
        </div>
        <div className="model-list">
          {providerConfig.models.map((model) => (
            <div className="model-row" key={model.id}>
              <input
                onChange={(event) => updateModel(model.id, { label: event.target.value })}
                value={model.label ?? model.id}
              />
              <label>
                <input
                  checked={model.supports1080p}
                  onChange={(event) => updateModel(model.id, { supports1080p: event.target.checked })}
                  type="checkbox"
                />
                <span>1080p</span>
              </label>
              <label>
                <input
                  checked={model.supportsWebSearch}
                  onChange={(event) => updateModel(model.id, { supportsWebSearch: event.target.checked })}
                  type="checkbox"
                />
                <span>web</span>
              </label>
              <label>
                <input
                  checked={model.supportsReturnLastFrame}
                  onChange={(event) => updateModel(model.id, { supportsReturnLastFrame: event.target.checked })}
                  type="checkbox"
                />
                <span>last</span>
              </label>
              <input
                className="small-number"
                onChange={(event) => updateModel(model.id, { durationMin: Number(event.target.value) })}
                type="number"
                value={model.durationMin}
              />
              <input
                className="small-number"
                onChange={(event) => updateModel(model.id, { durationMax: Number(event.target.value) })}
                type="number"
                value={model.durationMax}
              />
              <button className="icon-button danger-icon" onClick={() => removeModel(model.id)} title="删除模型" type="button">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>
        ) : null}

        {selectedSection === 'storage' ? (
      <ObjectStorageSettings
        api={api}
        initialConfig={draft.objectStorage}
        onError={onError}
        onSaved={(objectStorage) => {
          setDraft((current) => ({ ...current, objectStorage }))
          onObjectStorageSaved(objectStorage)
        }}
        onToast={onToast}
      />
        ) : null}
      </div>
    </div>
  )
}
