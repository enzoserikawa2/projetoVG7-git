import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Archive, Download, FileCheck2, HardDrive, ShieldCheck, Upload } from 'lucide-react'
import { useSaveState } from '../app/SaveContext'
import { Alert, Button, Card, PageTitle, Pill } from '../components/ui'
import { db } from '../db/database'
import { formatDateTime } from '../domain/ids'
import type { BackupManifest } from '../domain/types'
import { createBackup, downloadBackup, inspectBackup, restoreBackup } from '../services/backup'

interface StorageInfo {
  usage: number
  quota: number
  persisted: boolean
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function BackupPage() {
  const inspections = useLiveQuery(() => db.inspections.orderBy('updatedAt').reverse().toArray(), [], [])
  const { runSave } = useSaveState()
  const fileInput = useRef<HTMLInputElement>(null)
  const [storage, setStorage] = useState<StorageInfo>()
  const [busy, setBusy] = useState(false)
  const [pendingFile, setPendingFile] = useState<File>()
  const [pendingManifest, setPendingManifest] = useState<BackupManifest>()
  const [message, setMessage] = useState<string>()

  const readStorage = async (): Promise<StorageInfo> => {
    const estimate = await navigator.storage?.estimate?.()
    const persisted = (await navigator.storage?.persisted?.()) ?? false
    return { usage: estimate?.usage ?? 0, quota: estimate?.quota ?? 0, persisted }
  }

  const refreshStorage = async () => {
    setStorage(await readStorage())
  }

  useEffect(() => {
    let active = true
    void readStorage().then((result) => {
      if (active) setStorage(result)
    })
    return () => {
      active = false
    }
  }, [])

  const requestPersistence = async () => {
    const granted = (await navigator.storage?.persist?.()) ?? false
    setMessage(
      granted
        ? 'O navegador confirmou armazenamento persistente para esta origem.'
        : 'O navegador não concedeu persistência. Mantenha backups atualizados.'
    )
    await refreshStorage()
  }

  const exportData = async (inspectionId?: string) => {
    setBusy(true)
    setMessage(undefined)
    try {
      const backup = await createBackup(inspectionId)
      downloadBackup(backup)
      setMessage(`${backup.fileName} exportado. Guarde o arquivo em local seguro.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao criar o backup.')
    } finally {
      setBusy(false)
    }
  }

  const chooseFile = async (file?: File) => {
    if (!file) return
    setBusy(true)
    setMessage(undefined)
    try {
      const result = await inspectBackup(file)
      setPendingFile(file)
      setPendingManifest(result.manifest)
    } catch (error) {
      setPendingFile(undefined)
      setPendingManifest(undefined)
      setMessage(error instanceof Error ? error.message : 'Backup inválido.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const restore = async () => {
    if (!pendingFile || !pendingManifest) return
    if (
      !window.confirm(
        'Restaurar este backup? Registros com o mesmo identificador serão atualizados; os demais dados atuais serão preservados.'
      )
    ) return
    setBusy(true)
    try {
      const counts = await runSave(() => restoreBackup(pendingFile))
      setMessage(
        `Restauração concluída: ${counts.inspections} vistoria(s), ${counts.photos} fotografia(s) e ${counts.libraryItems} item(ns) técnicos.`
      )
      setPendingFile(undefined)
      setPendingManifest(undefined)
      await refreshStorage()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao restaurar o backup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageTitle
        eyebrow="Proteção dos registros"
        title="Backup e armazenamento"
        description="Os dados não são sincronizados. O arquivo de backup é a proteção contra limpeza, desinstalação ou perda do dispositivo."
      />

      <Alert title="Dados exclusivamente locais" tone="warning">
        Desinstalar a PWA, apagar os dados do navegador ou perder o dispositivo pode remover todas as vistorias. Exporte backups regularmente.
      </Alert>

      <div className="backup-grid">
        <Card className="storage-card">
          <div className="storage-card__icon"><HardDrive size={26} /></div>
          <div className="section-heading">
            <div><h2>Armazenamento do navegador</h2><p>Estimativa para esta origem.</p></div>
            <Pill tone={storage?.persisted ? 'success' : 'warning'}>
              {storage?.persisted ? 'Persistente' : 'Não confirmado'}
            </Pill>
          </div>
          {storage && (
            <>
              <div className="storage-meter">
                <span style={{ width: `${storage.quota ? Math.min(100, (storage.usage / storage.quota) * 100) : 0}%` }} />
              </div>
              <p>{formatBytes(storage.usage)} utilizados de aproximadamente {formatBytes(storage.quota)}</p>
            </>
          )}
          <Button variant="secondary" onClick={() => void requestPersistence()} icon={<ShieldCheck size={18} />}>
            Solicitar persistência
          </Button>
        </Card>

        <Card className="backup-action-card">
          <div className="storage-card__icon"><Archive size={26} /></div>
          <h2>Backup completo</h2>
          <p>Inclui configurações, biblioteca, vistorias, fotografias e histórico de geração.</p>
          <Button full busy={busy} onClick={() => void exportData()} icon={<Download size={18} />}>
            Exportar tudo
          </Button>
        </Card>

        <Card className="backup-action-card">
          <div className="storage-card__icon"><Upload size={26} /></div>
          <h2>Restaurar backup</h2>
          <p>O arquivo é validado por estrutura, versão, vínculos e SHA-256 antes da importação.</p>
          <input
            ref={fileInput}
            type="file"
            className="sr-only"
            accept=".vg7backup,application/zip,application/vnd.vg7.hvac-backup+zip"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <Button full variant="secondary" busy={busy} onClick={() => fileInput.current?.click()} icon={<Upload size={18} />}>
            Selecionar arquivo
          </Button>
        </Card>
      </div>

      {pendingManifest && (
        <Card className="restore-preview">
          <FileCheck2 size={30} />
          <div>
            <h2>Backup validado</h2>
            <p>Exportado em {formatDateTime(pendingManifest.exportedAt)}</p>
            <div className="inspection-meta">
              <span>{pendingManifest.counts.inspections} vistoria(s)</span>
              <span>{pendingManifest.counts.photos} fotografia(s)</span>
              <span>{pendingManifest.counts.libraryItems} item(ns) técnicos</span>
              <span>{pendingManifest.counts.reportRuns} relatório(s)</span>
            </div>
          </div>
          <div className="button-row">
            <Button busy={busy} onClick={() => void restore()}>Restaurar e mesclar</Button>
            <Button variant="ghost" onClick={() => { setPendingFile(undefined); setPendingManifest(undefined) }}>Cancelar</Button>
          </div>
        </Card>
      )}

      {message && <Alert title="Resultado" tone="info">{message}</Alert>}

      <section className="individual-backups">
        <div className="section-heading">
          <div><h2>Backup de uma vistoria</h2><p>Inclui também a biblioteca necessária para interpretação dos dados.</p></div>
          <Pill>{inspections.length}</Pill>
        </div>
        <div className="individual-backup-list">
          {inspections.map((inspection) => (
            <div key={inspection.id} className="individual-backup-row">
              <div><strong>{inspection.facility || inspection.client || 'Vistoria sem título'}</strong><span>{inspection.client}</span></div>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void exportData(inspection.id)}
                icon={<Download size={17} />}
              >
                Exportar
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
