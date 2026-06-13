import { CheckCircle2, Save, TestTube2, UploadCloud } from 'lucide-react'
import type { JSX } from 'react'
import { useEffect, useState } from 'react'

import type { ObjectStorageConfig, ObjectStorageVendor } from '@hoodmagic/video-core'

import type { VideoToolApi } from '../../../../shared/video'
import { SelectMenu } from '../SelectMenu'

type ObjectStorageSettingsProps = {
  api: VideoToolApi
  initialConfig: ObjectStorageConfig
  onSaved: (config: ObjectStorageConfig) => void
  onToast: (message: string) => void
  onError: (message: string) => void
}

const vendors: Array<{ value: ObjectStorageVendor; label: string }> = [
  { value: 'aliyun-oss', label: '阿里云 OSS' },
  { value: 'volcengine-tos', label: '火山 TOS' },
  { value: 'tencent-cos', label: '腾讯 COS' }
]
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const cloneConfig = (config: ObjectStorageConfig): ObjectStorageConfig => JSON.parse(JSON.stringify(config)) as ObjectStorageConfig

export function ObjectStorageSettings({
  api,
  initialConfig,
  onSaved,
  onToast,
  onError
}: ObjectStorageSettingsProps): JSX.Element {
  const [draft, setDraft] = useState<ObjectStorageConfig>(() => cloneConfig(initialConfig))
  const [busy, setBusy] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  useEffect(() => {
    setDraft(cloneConfig(initialConfig))
  }, [initialConfig])

  const updateDraft = (patch: Partial<ObjectStorageConfig>): void => {
    setDraft((current) => ({
      ...current,
      ...patch
    }))
  }

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try {
      await action()
    } catch (error) {
      console.error('[object-storage-settings]', error)
      setSaveState('error')
      window.setTimeout(() => setSaveState('idle'), 2200)
      onError(error instanceof Error ? error.message : '对象存储操作失败。')
    } finally {
      setBusy(false)
    }
  }

  const save = async (): Promise<void> => {
    setSaveState('saving')
    const saved = await api.saveObjectStorageConfig(draft)
    setDraft(saved)
    onSaved(saved)
    setSaveState('saved')
    window.setTimeout(() => setSaveState('idle'), 1800)
    onToast('对象存储设置已保存。')
  }

  const testConnection = async (): Promise<void> => {
    const saved = await api.saveObjectStorageConfig(draft)
    setDraft(saved)
    onSaved(saved)
    const result = await api.testObjectStorageConnection()
    onToast(result.message)
  }

  const testSts = async (): Promise<void> => {
    const saved = await api.saveObjectStorageConfig(draft)
    setDraft(saved)
    onSaved(saved)
    const result = await api.testObjectStorageSts()
    onToast(result.message)
  }

  const uploadTestFile = async (): Promise<void> => {
    const saved = await api.saveObjectStorageConfig(draft)
    setDraft(saved)
    onSaved(saved)
    const result = await api.testObjectStorageUploadFile()
    onToast(`测试文件已上传：${result.publicUrl}`)
  }

  return (
    <section className="panel settings-panel object-storage-panel">
      <div className="panel-heading settings-panel-heading">
        <h2>对象存储设置</h2>
        <button
          className={
            saveState === 'saved'
              ? 'primary-button compact-primary settings-save-button save-button-saved'
              : saveState === 'error'
                ? 'primary-button compact-primary settings-save-button save-button-error'
                : 'primary-button compact-primary settings-save-button'
          }
          disabled={busy}
          onClick={() => void run(save)}
          type="button"
        >
          {saveState === 'saved' ? <CheckCircle2 size={15} /> : <Save size={15} />}
          <span>{saveState === 'saving' ? '保存中...' : saveState === 'saved' ? '已保存' : '保存对象存储'}</span>
        </button>
      </div>
      <div className="settings-save-feedback" aria-live="polite">
        {saveState === 'saved'
          ? '对象存储设置已保存到本地。'
          : saveState === 'error'
            ? '保存失败，请检查错误提示。'
            : '修改对象存储配置后点击右上角保存。'}
      </div>
      <p className="notice">
        长期密钥仅建议本地开发使用，不建议分发给其他用户。正式分发建议使用 STS 临时凭证接口。Bucket 或对象必须能被火山引擎服务端公网访问；Renderer 直传时还需要 CORS，本工具当前优先在 Main 进程上传。
      </p>
      <div className="settings-form-grid">
        <label className="toggle-card span-all">
          <input checked={draft.enabled} onChange={(event) => updateDraft({ enabled: event.target.checked })} type="checkbox" />
          <span>启用对象存储上传</span>
        </label>
        <label className="field">
          <span>当前云厂商</span>
          <SelectMenu
            onChange={(value) => updateDraft({ vendor: value as ObjectStorageVendor })}
            options={vendors}
            value={draft.vendor}
          />
        </label>
        <label className="field">
          <span>上传模式</span>
          <SelectMenu
            onChange={(value) => updateDraft({ authMode: value as ObjectStorageConfig['authMode'] })}
            options={[
              { value: 'long_term_key', label: '长期密钥' },
              { value: 'sts', label: 'STS 临时凭证' }
            ]}
            value={draft.authMode}
          />
        </label>
        <label className="field">
          <span>{draft.vendor === 'tencent-cos' ? 'secretId' : 'accessKeyId'}</span>
          <input
            onChange={(event) =>
              draft.vendor === 'tencent-cos'
                ? updateDraft({ secretId: event.target.value })
                : updateDraft({ accessKeyId: event.target.value })
            }
            value={draft.vendor === 'tencent-cos' ? (draft.secretId ?? '') : (draft.accessKeyId ?? '')}
          />
        </label>
        <label className="field">
          <span>{draft.vendor === 'tencent-cos' ? 'secretKey' : 'accessKeySecret'}</span>
          <input
            onChange={(event) =>
              draft.vendor === 'tencent-cos'
                ? updateDraft({ secretKey: event.target.value })
                : updateDraft({ accessKeySecret: event.target.value })
            }
            type="password"
            value={draft.vendor === 'tencent-cos' ? (draft.secretKey ?? '') : (draft.accessKeySecret ?? '')}
          />
        </label>
        <label className="field">
          <span>securityToken / stsToken</span>
          <input
            onChange={(event) => updateDraft({ securityToken: event.target.value, stsToken: event.target.value })}
            type="password"
            value={draft.securityToken ?? draft.stsToken ?? ''}
          />
        </label>
        <label className="field">
          <span>region</span>
          <input onChange={(event) => updateDraft({ region: event.target.value })} value={draft.region} />
        </label>
        <label className="field">
          <span>endpoint</span>
          <input
            onChange={(event) => updateDraft({ endpoint: event.target.value })}
            placeholder={draft.vendor === 'tencent-cos' ? '腾讯 COS 可留空' : 'oss-cn-beijing.aliyuncs.com'}
            value={draft.endpoint ?? ''}
          />
        </label>
        <label className="field">
          <span>bucket</span>
          <input onChange={(event) => updateDraft({ bucket: event.target.value })} value={draft.bucket} />
        </label>
        <label className="field">
          <span>keyPrefix</span>
          <input onChange={(event) => updateDraft({ keyPrefix: event.target.value })} value={draft.keyPrefix ?? ''} />
        </label>
        <label className="field">
          <span>publicDomain</span>
          <input
            onChange={(event) => updateDraft({ publicDomain: event.target.value })}
            placeholder="https://cdn.example.com"
            value={draft.publicDomain ?? ''}
          />
        </label>
        <label className="field">
          <span>STS Endpoint URL</span>
          <input onChange={(event) => updateDraft({ stsEndpointUrl: event.target.value })} value={draft.stsEndpointUrl ?? ''} />
        </label>
        <label className="field">
          <span>STS Request Headers JSON</span>
          <input
            onChange={(event) => updateDraft({ stsRequestHeaders: event.target.value })}
            placeholder='{"x-api-key":"..."}'
            value={draft.stsRequestHeaders ?? ''}
          />
        </label>
        <label className="field">
          <span>凭证提前刷新秒数</span>
          <input
            onChange={(event) => updateDraft({ credentialRefreshBeforeExpireSeconds: Number(event.target.value) })}
            type="number"
            value={draft.credentialRefreshBeforeExpireSeconds}
          />
        </label>
        <div className="toggle-row span-all">
          <label>
            <input
              checked={draft.generatePublicUrl}
              onChange={(event) => updateDraft({ generatePublicUrl: event.target.checked })}
              type="checkbox"
            />
            <span>生成公开访问 URL</span>
          </label>
          <label>
            <input
              checked={draft.autoCreateSeedanceAsset}
              onChange={(event) => updateDraft({ autoCreateSeedanceAsset: event.target.checked })}
              type="checkbox"
            />
            <span>上传后自动创建 Seedance 素材</span>
          </label>
          <label>
            <input
              checked={draft.autoPollAssetActive}
              onChange={(event) => updateDraft({ autoPollAssetActive: event.target.checked })}
              type="checkbox"
            />
            <span>自动等待素材可用</span>
          </label>
        </div>
      </div>
      <div className="object-storage-actions">
        <button className="secondary-button" disabled={busy} onClick={() => void run(testConnection)} type="button">
          <TestTube2 size={15} />
          <span>测试连接</span>
        </button>
        <button className="secondary-button" disabled={busy} onClick={() => void run(testSts)} type="button">
          <TestTube2 size={15} />
          <span>测试临时凭证</span>
        </button>
        <button className="secondary-button" disabled={busy} onClick={() => void run(uploadTestFile)} type="button">
          <UploadCloud size={15} />
          <span>上传测试文件</span>
        </button>
      </div>
    </section>
  )
}
