import { useEffect, useMemo, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, ImagePlus, Trash2, UserRoundCog } from 'lucide-react'
import { useSaveState } from '../app/SaveContext'
import { AutosaveInput, AutosaveTextarea } from '../components/AutosaveField'
import { Alert, Button, Card, PageTitle, Skeleton } from '../components/ui'
import { db } from '../db/database'
import { saveSettings } from '../db/repository'
import type { ProfessionalSettings } from '../domain/types'

type SettingsTextField = Exclude<
  keyof ProfessionalSettings,
  'id' | 'schemaVersion' | 'createdAt' | 'updatedAt' | 'logoBlob' | 'logoFileName'
>

export function SettingsPage() {
  const settings = useLiveQuery(() => db.settings.get('professional'))
  const { runSave } = useSaveState()
  const logoInput = useRef<HTMLInputElement>(null)
  const logoUrl = useMemo(
    () => (settings?.logoBlob ? URL.createObjectURL(settings.logoBlob) : ''),
    [settings]
  )
  useEffect(() => () => {
    if (logoUrl) URL.revokeObjectURL(logoUrl)
  }, [logoUrl])

  if (!settings) return <Skeleton height={520} />

  const saveText = (field: SettingsTextField) => async (value: string) => {
    await saveSettings((draft) => {
      draft[field] = value
    })
  }

  const saveLogo = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      window.alert('Use uma imagem PNG ou JPEG para garantir compatibilidade com o PDF offline.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      window.alert('A imagem deve ter no máximo 5 MB.')
      return
    }
    await runSave(() =>
      saveSettings((draft) => {
        draft.logoBlob = file
        draft.logoFileName = file.name
      })
    )
    if (logoInput.current) logoInput.current.value = ''
  }

  const removeLogo = async () => {
    await runSave(() =>
      saveSettings((draft) => {
        draft.logoBlob = undefined
        draft.logoFileName = undefined
      })
    )
  }

  return (
    <div>
      <PageTitle
        eyebrow="Identidade profissional"
        title="Configurações do relatório"
        description="Estas informações serão copiadas para novas vistorias ou utilizadas na geração do PDF."
      />

      <Alert title="Revise antes da primeira emissão" tone="info">
        Nome, CREA, empresa e textos padrão não são validados por serviços externos.
      </Alert>

      <Card className="form-card">
        <div className="form-section">
          <div className="section-heading">
            <div><h2>Responsável técnico</h2><p>Dados profissionais exibidos no relatório.</p></div>
            <UserRoundCog size={25} />
          </div>
          <div className="form-grid form-grid--2">
            <AutosaveInput label="Nome do engenheiro" value={settings.engineerName} onSave={saveText('engineerName')} />
            <AutosaveInput label="CREA" value={settings.crea} onSave={saveText('crea')} />
            <AutosaveInput label="Contato" value={settings.contact} onSave={saveText('contact')} />
            <AutosaveInput type="email" label="E-mail" value={settings.email} onSave={saveText('email')} />
          </div>
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div><h2>Empresa e identidade</h2><p>O logo é opcional e armazenado somente neste dispositivo.</p></div>
            <Building2 size={25} />
          </div>
          <AutosaveInput label="Empresa" value={settings.companyName} onSave={saveText('companyName')} />
          <div className="logo-editor">
            <div className="logo-preview">
              {logoUrl ? <img src={logoUrl} alt="Logo configurado" /> : <span>VG7</span>}
            </div>
            <div>
              <strong>{settings.logoFileName || 'Nenhum logo enviado'}</strong>
              <p>PNG ou JPEG, até 5 MB. A proporção será preservada.</p>
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(event) => void saveLogo(event.target.files?.[0])}
              />
              <div className="button-row">
                <Button variant="secondary" onClick={() => logoInput.current?.click()} icon={<ImagePlus size={18} />}>
                  Selecionar logo
                </Button>
                {settings.logoBlob && (
                  <Button variant="ghost" onClick={() => void removeLogo()} icon={<Trash2 size={18} />}>
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="form-grid form-grid--2">
            <AutosaveInput label="Cabeçalho" value={settings.reportHeader} onSave={saveText('reportHeader')} />
            <AutosaveInput label="Rodapé" value={settings.reportFooter} onSave={saveText('reportFooter')} />
          </div>
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div><h2>Textos para novas vistorias</h2><p>Servem como ponto de partida e permanecem editáveis em cada registro.</p></div>
          </div>
          <AutosaveTextarea label="Finalidade padrão" value={settings.defaultPurpose} onSave={saveText('defaultPurpose')} />
          <AutosaveTextarea label="Escopo padrão" value={settings.defaultScope} onSave={saveText('defaultScope')} />
          <AutosaveTextarea
            label="Metodologia padrão"
            value={settings.defaultMethodology}
            onSave={saveText('defaultMethodology')}
          />
          <AutosaveTextarea
            label="Limitações padrão"
            value={settings.defaultLimitations}
            onSave={saveText('defaultLimitations')}
          />
        </div>
      </Card>
    </div>
  )
}
