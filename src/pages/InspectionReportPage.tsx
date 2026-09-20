import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Download, ExternalLink, FileCheck2, LoaderCircle, Share2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { Alert, Button, Card, PageTitle, Pill, Skeleton } from '../components/ui'
import { db } from '../db/database'
import { mutateInspection } from '../db/repository'
import { createId, formatDate, formatDateTime, nowIso } from '../domain/ids'
import { findEquipment, findLocation, getReviewSummary } from '../domain/inspection'
import { APP_SCHEMA_VERSION, type ReportRun } from '../domain/types'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection, useInspectionPhotos } from '../features/inspections/useInspection'
import {
  canSharePdf,
  downloadPdf,
  generateReportPdf,
  sharePdf,
  type GeneratedReport
} from '../services/report-pdf'

export function InspectionReportPage() {
  const { inspectionId } = useParams()
  const inspection = useInspection(inspectionId)
  const photos = useInspectionPhotos(inspectionId)
  const settings = useLiveQuery(() => db.settings.get('professional'))
  const runs = useLiveQuery<ReportRun[], ReportRun[]>(
    () =>
      inspectionId
        ? db.reportRuns.where('inspectionId').equals(inspectionId).sortBy('reportVersion')
        : Promise.resolve([]),
    [inspectionId],
    []
  )
  const { runSave } = useSaveState()
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<GeneratedReport>()
  const [message, setMessage] = useState<string>()
  const [acknowledgedWarnings, setAcknowledgedWarnings] = useState(false)
  const route = inspectionId ? `/inspection/${inspectionId}/report` : ''

  useEffect(() => {
    if (!inspection || inspection.lastRoute === route) return
    void mutateInspection(inspection.id, (draft) => {
      draft.lastRoute = route
    })
  }, [inspection, route])

  const reportUrl = useMemo(() => (report ? URL.createObjectURL(report.blob) : ''), [report])
  useEffect(() => () => {
    if (reportUrl) URL.revokeObjectURL(reportUrl)
  }, [reportUrl])

  const summary = useMemo(
    () => (inspection ? getReviewSummary(inspection, photos.length) : undefined),
    [inspection, photos.length]
  )

  if (!inspection || !settings || !summary) return <Skeleton height={620} />
  const hasBlockingWarnings = summary.warnings.some((warning) => warning.blocking)
  const hasNonBlockingWarnings = summary.warnings.some((warning) => !warning.blocking)
  const warningsAcknowledged =
    !hasNonBlockingWarnings || Boolean(inspection.pendingAcknowledgedAt) || acknowledgedWarnings
  const canGenerate = !hasBlockingWarnings && warningsAcknowledged

  const generate = async () => {
    if (hasBlockingWarnings) {
      setMessage('Há pendências bloqueantes. Volte à revisão e corrija-as antes de gerar o relatório.')
      return
    }
    if (!warningsAcknowledged) {
      setMessage('Confirme que está ciente das pendências não bloqueantes antes de gerar o relatório.')
      return
    }
    setGenerating(true)
    setMessage(undefined)
    try {
      const reportVersion = Math.max(0, ...runs.map((item) => item.reportVersion)) + 1
      const generated = await generateReportPdf({
        inspection,
        settings,
        photos,
        reportVersion
      })
      await runSave(async () => {
        const timestamp = nowIso()
        await db.transaction('rw', [db.reportRuns, db.inspections], async () => {
          await db.reportRuns.add({
            id: createId(),
            schemaVersion: APP_SCHEMA_VERSION,
            createdAt: timestamp,
            updatedAt: timestamp,
            inspectionId: inspection.id,
            inspectionRevision: inspection.revision,
            reportVersion,
            fileName: generated.fileName,
            generatedAt: timestamp,
            sha256: generated.sha256,
            acknowledgedWarnings: summary.warnings.map((warning) => warning.code)
          })
          const current = await db.inspections.get(inspection.id)
          if (!current) throw new Error('Vistoria não encontrada.')
          current.status = 'finalizada'
          current.finalizedAt = timestamp
          current.lastRoute = route
          current.updatedAt = timestamp
          current.revision += 1
          await db.inspections.put(current)
        })
      })
      setReport(generated)
      setMessage(`${generated.fileName} gerado integralmente neste dispositivo.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao gerar o relatório.')
    } finally {
      setGenerating(false)
    }
  }

  const share = async () => {
    if (!report) return
    try {
      await sharePdf(report)
      setMessage('Menu de compartilhamento aberto. Selecione o Google Drive ou outro destino.')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(error instanceof Error ? error.message : 'Não foi possível compartilhar o arquivo.')
    }
  }

  const confirmedReferences = inspection.occurrences.reduce(
    (total, occurrence) => total + occurrence.references.filter((item) => item.applicabilityConfirmed).length,
    0
  )

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow="Prévia do relatório"
        title="Relatório técnico HVAC"
        description="Esta prévia apresenta o conteúdo. A paginação definitiva é calculada na geração do PDF A4."
        action={<Pill tone={inspection.status === 'finalizada' ? 'success' : 'warning'}>{inspection.status === 'finalizada' ? 'PDF já emitido' : 'Não emitido'}</Pill>}
      />

      {inspection.isDemo && (
        <Alert title="Documento exclusivamente demonstrativo" tone="warning">
          O PDF será marcado como conteúdo fictício, sem valor técnico.
        </Alert>
      )}

      {hasBlockingWarnings && (
        <Alert title="Geração bloqueada por pendências técnicas" tone="danger">
          O relatório só pode ser emitido após a correção dos itens bloqueantes identificados na revisão.
        </Alert>
      )}

      {!hasBlockingWarnings && hasNonBlockingWarnings && !inspection.pendingAcknowledgedAt && (
        <label className="acknowledgement">
          <input
            type="checkbox"
            checked={acknowledgedWarnings}
            onChange={(event) => setAcknowledgedWarnings(event.target.checked)}
          />
          <span>
            <strong>Estou ciente das pendências não bloqueantes.</strong>
            <small>Esta confirmação será registrada no histórico da versão gerada.</small>
          </span>
        </label>
      )}

      <article className="report-preview">
        <header className="report-preview__cover">
          <div className="report-preview__brand">VG7 <span>ENGENHARIA</span></div>
          <div className="report-preview__line" />
          <p>RELATÓRIO TÉCNICO</p>
          <h2>VISTORIA HVAC</h2>
          <h3>{inspection.facility || 'Empreendimento não informado'}</h3>
          <dl>
            <div><dt>Cliente</dt><dd>{inspection.client || 'Não informado'}</dd></div>
            <div><dt>Data</dt><dd>{formatDate(inspection.inspectionDate)}</dd></div>
            <div><dt>Responsável técnico</dt><dd>{inspection.technicalLead || 'Não informado'}</dd></div>
            <div><dt>Endereço</dt><dd>{inspection.address || 'Não informado'}</dd></div>
          </dl>
        </header>

        <section><h2>Objetivo e escopo</h2><p>{inspection.purpose}</p><p>{inspection.scope}</p></section>
        <section><h2>Metodologia</h2><p>{inspection.methodology}</p></section>
        <section><h2>Limitações</h2><p>{inspection.limitations || 'Nenhuma limitação geral informada.'}</p></section>

        <section>
          <h2>Resumo quantitativo</h2>
          <div className="preview-summary-grid">
            <span><strong>{summary.conforme}</strong>Conformes</span>
            <span><strong>{summary.naoConforme}</strong>Não conformes</span>
            <span><strong>{summary.naoAplicavel}</strong>Não aplicáveis</span>
            <span><strong>{summary.naoInspecionado}</strong>Não inspecionados</span>
          </div>
        </section>

        <section>
          <div className="section-heading"><h2>Não conformidades</h2><Pill>{inspection.occurrences.length}</Pill></div>
          {inspection.occurrences.map((occurrence) => {
            const location = findLocation(inspection, occurrence.locationId)
            const equipment = findEquipment(inspection, occurrence.locationId, occurrence.equipmentId)
            return (
              <div className="preview-occurrence" key={occurrence.id}>
                <div className="preview-occurrence__number">NC-{String(occurrence.internalNumber).padStart(3, '0')}</div>
                <div>
                  <h3>{occurrence.title}</h3>
                  <small>{location?.name} • {equipment?.tag ?? 'Sem equipamento específico'}</small>
                  <h4>Constatação</h4><p>{occurrence.finding}</p>
                  <h4>Recomendação</h4><p>{occurrence.recommendation}</p>
                  <p><strong>Criticidade confirmada:</strong> {occurrence.confirmedCriticalityLabel ?? 'Não confirmada'}</p>
                </div>
              </div>
            )
          })}
        </section>

        <section><h2>Conclusão</h2><p>{inspection.conclusion}</p></section>
        <footer>
          {photos.length} fotografia(s) • {confirmedReferences} referência(s) confirmada(s) • Anexo de rastreabilidade incluído
        </footer>
      </article>

      {message && <Alert title={report ? 'Relatório pronto' : 'Geração do relatório'} tone={report ? 'success' : 'info'}>{message}</Alert>}

      {report && (
        <Card className="generated-report-card">
          <div className="generated-report-card__icon"><FileCheck2 size={28} /></div>
          <div>
            <h2>{report.fileName}</h2>
            <p>SHA-256: <code>{report.sha256.slice(0, 16)}…</code></p>
          </div>
          <div className="button-row">
            {reportUrl && (
              <a className="button button--secondary" href={reportUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={18} /> Abrir PDF
              </a>
            )}
            {canSharePdf(report) && <Button onClick={() => void share()} icon={<Share2 size={18} />}>Compartilhar</Button>}
            <Button variant="secondary" onClick={() => downloadPdf(report)} icon={<Download size={18} />}>Baixar</Button>
          </div>
        </Card>
      )}

      {runs.length > 0 && (
        <Card className="report-history">
          <div className="section-heading"><h2>Histórico de geração</h2><Pill>{runs.length}</Pill></div>
          {runs.slice().reverse().map((run) => (
            <div className="report-history__row" key={run.id}>
              <span>V{String(run.reportVersion).padStart(2, '0')}</span>
              <div><strong>{run.fileName}</strong><small>{formatDateTime(run.generatedAt)} • revisão local {run.inspectionRevision}</small></div>
              <code>{run.sha256.slice(0, 10)}…</code>
            </div>
          ))}
        </Card>
      )}

      <div className="sticky-actions sticky-actions--split">
        <Link className="button button--secondary" to={`/inspection/${inspection.id}/review`}>Voltar à revisão</Link>
        <Button
          busy={generating}
          disabled={!canGenerate}
          onClick={() => void generate()}
          icon={generating ? <LoaderCircle className="spin" /> : <FileCheck2 size={19} />}
        >
          {runs.length ? 'Gerar nova versão' : 'Gerar PDF final'}
        </Button>
      </div>
    </div>
  )
}
