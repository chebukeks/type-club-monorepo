import type { TranslationKey } from './i18n'

const downloadRoles = [
  ['co_author', 'role.co_author'],
  ['editor', 'role.editor'],
  ['reader', 'publish.downloadReaders'],
] as const

const checkboxModes = [
  ['disabled', 'publish.checkboxesDisabled'],
  ['temporary', 'publish.checkboxesTemporary'],
  ['persistent', 'publish.checkboxesPersistent'],
  ['document', 'publish.checkboxesDocument'],
] as const

export type PublicationOptions = {
  download_roles: (typeof downloadRoles)[number][0][]
  checkbox_mode: (typeof checkboxModes)[number][0]
}

export const defaultPublication: PublicationOptions = {
  download_roles: ['co_author', 'editor'],
  checkbox_mode: 'disabled',
}

interface PublicationFieldsProps {
  value: PublicationOptions
  onChange: (value: PublicationOptions) => void
  disabled?: boolean
  t: (key: TranslationKey) => string
}

export function PublicationFields({ value, onChange, disabled, t }: PublicationFieldsProps) {
  return (
    <fieldset disabled={disabled} style={{ display: 'grid', gap: 12, marginBottom: 16, fontSize: 13 }}>
      <fieldset>
        <legend style={{ fontWeight: 600, marginBottom: 5 }}>{t('publish.downloadPermissions')}</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {downloadRoles.map(([role, label]) => (
            <label key={role} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <input
                type="checkbox"
                checked={value.download_roles.includes(role)}
                style={{ accentColor: 'var(--accent)' }}
                onChange={(event) => onChange({
                  ...value,
                  download_roles: event.currentTarget.checked
                    ? [...value.download_roles, role]
                    : value.download_roles.filter((current) => current !== role),
                })}
              />
              {t(label)}
            </label>
          ))}
        </div>
      </fieldset>
      <label style={{ display: 'grid', gap: 5 }}>
        <span style={{ fontWeight: 600 }}>{t('publish.checkboxes')}</span>
        <select
          value={value.checkbox_mode}
          onChange={(event) => onChange({ ...value, checkbox_mode: event.target.value as PublicationOptions['checkbox_mode'] })}
          style={{
            padding: '6px 8px', border: '1px solid var(--border-default)', borderRadius: 6,
            background: 'var(--bg-input)', color: 'var(--text-primary)',
          }}
        >
          {checkboxModes.map(([mode, label]) => <option key={mode} value={mode}>{t(label)}</option>)}
        </select>
        {value.checkbox_mode === 'document' && (
          <span style={{ color: 'var(--text-muted)' }}>{t('publish.checkboxesDocumentHint')}</span>
        )}
      </label>
    </fieldset>
  )
}
