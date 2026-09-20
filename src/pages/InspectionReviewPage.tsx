import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ArrowRight, CameraOff, CheckCircle2, FileWarning, ShieldAlert } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { AutosaveTextarea } from '../components/AutosaveField'
import { Alert, Button, Card, PageTitle, Pill, Skeleton, Stat } from '../components/ui'
import { mutateInspection } from '../db/repository'
import { nowIso } from '../domain/ids'
import { findEquipment, findLocation, getReviewSummary } from '../domain/inspection'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection, useInspectionPhotos } from '../features/inspections/useInspection'

export function InspectionReviewPage() {
  const { inspectionId } = useParams()
  const inspection = useInspection(inspectionId)
  const photos = useInspectionPhotos(inspectionId)
  const { runSave } = useSaveState()
  const navigate = useNavigate()
  const [acknowledged, setAcknowledged] = useState(false)
  const route = inspectionId ? `/inspection/${inspectionId}/review` : ''

  useEffect(() => {
    if (!inspection || inspection.lastRoute === route) return
    void mutateInspection(inspection.id, (draft) => {
      draft.lastRoute = route
    })
  }, [inspection, route])

  const summary = useMemo(
    () => (inspection ? getReviewSummary(inspection, photos.length) : undefined),
    [inspection, photos.length]
  )

  if (!inspection || !summary) return <Skeleton height={620} />
  const blocking = summary.warnings.some((warning) => warning.blocking)
  const nonBlocking = summary.warnings.some((warning) => !warning.blocking)

  const saveConclusion = async (conclusion: string) => {
    await mutateInspection(inspection.id, (draft) => {
      draft.conclusion = conclusion
    })
  }

  const continueToReport = async () => {
    if (blocking) return
    if (nonBlocking && !acknowledged) return
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        draft.pendingAcknowledgedAt = summary.warnings.length > 0 ? nowIso() : undefined
      })
    )
    navigate(`/inspection/${inspection.id}/report`)
  }

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow="Etapa de validação"
        title="Resumo e revisão técnica"
        description="Confira a completude do registro antes de preparar o relatório. Contagens não substituem a avaliação do engenheiro."
      />

      <div className="stats-grid review-stats">
        <Stat label="Locais" value={summary.locations} />
        <Stat label="Equipamentos" value={summary.equipment} />
        <Stat label="Critérios" value={summary.totalCriteria} />
        <Stat label="Fotografias" value={summary.photos} />
        <Stat label="Conformes" value={summary.conforme} tone="success" />
        <Stat label="Não conformes" value={summary.naoConforme} tone="danger" />
        <Stat label="Não aplicáveis" value={summary.naoAplicavel} tone="info" />
        <Stat label="Não inspecionados" value={summary.naoInspecionado} tone="warning" />
      </div>

      <section className="review-section">
        <div className="section-heading">
          <div><h2>Pendências encontradas</h2><p>Itens bloqueantes exigem correção; os demais exigem confirmação consciente.</p></div>
          <Pill tone={summary.warnings.length === 0 ? 'success' : 'warning'}>
            {summary.warnings.length === 0 ? 'Sem pendências' : `${summary.warnings.length} alerta(s)`}
          </Pill>
        </div>
        {summary.warnings.length === 0 ? (
          <Alert title="Conteúdo pronto para prévia" tone="success">
            Nenhuma pendência automática foi identificada. A revisão técnica final continua sendo necessária.
          </Alert>
        ) : (
          <div className="warning-list">
            {summary.warnings.map((warning) => (
              <Alert key={warning.code} title={warning.label} tone={warning.blocking ? 'danger' : 'warning'}>
                {warning.detail} {warning.blocking && <strong>Corrija antes de avançar.</strong>}
              </Alert>
            ))}
          </div>
        )}
      </section>

      <section className="review-section">
        <div className="section-heading">
          <div><h2>Ocorrências</h2><p>Revise constatação, recomendação, criticidade e evidências.</p></div>
          <Pill>{summary.occurrences} registro(s)</Pill>
        </div>
        {inspection.occurrences.length === 0 ? (
          <Alert title="Nenhuma ocorrência registrada" tone="info">
            Confirme se esta situação corresponde ao que foi observado. Isso não representa conformidade global.
          </Alert>
        ) : (
          <div className="review-occurrence-list">
            {inspection.occurrences
              .slice()
              .sort((a, b) => a.internalNumber - b.internalNumber)
              .map((occurrence) => {
                const location = findLocation(inspection, occurrence.locationId)
                const equipment = findEquipment(inspection, occurrence.locationId, occurrence.equipmentId)
                return (
                  <Card key={occurrence.id} className="review-occurrence">
                    <div className="review-occurrence__number">NC-{String(occurrence.internalNumber).padStart(3, '0')}</div>
                    <div className="review-occurrence__body">
                      <h3>{occurrence.title || 'Ocorrência sem título'}</h3>
                      <p>{location?.name ?? 'Local ausente'} • {equipment?.tag ?? 'Sem equipamento específico'}</p>
                      <div className="review-occurrence__flags">
                        <span className={occurrence.photoIds.length ? 'ok' : 'warning'}>
                          {occurrence.photoIds.length ? <CheckCircle2 /> : <CameraOff />}
                          {occurrence.photoIds.length} foto(s)
                        </span>
                        <span className={occurrence.confirmedCriticalityId ? 'ok' : 'warning'}>
                          {occurrence.confirmedCriticalityId ? <CheckCircle2 /> : <ShieldAlert />}
                          {occurrence.confirmedCriticalityLabel ?? 'Criticidade não confirmada'}
                        </span>
                        <span className={occurrence.references.some((item) => item.applicabilityConfirmed) ? 'ok' : 'neutral'}>
                          <FileWarning />
                          {occurrence.references.filter((item) => item.applicabilityConfirmed).length} referência(s) confirmada(s)
                        </span>
                      </div>
                    </div>
                    <Link className="button button--secondary" to={`/inspection/${inspection.id}/occurrence/${occurrence.id}`}>
                      Revisar
                    </Link>
                  </Card>
                )
              })}
          </div>
        )}
      </section>

      <section className="review-section">
        <div className="section-heading">
          <div><h2>Limitações registradas</h2><p>Serão apresentadas no relatório.</p></div>
          <Pill>{summary.limitations.length}</Pill>
        </div>
        {summary.limitations.length ? (
          <ul className="limitation-list">
            {summary.limitations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        ) : (
          <Alert title="Nenhuma limitação registrada" tone="warning">
            Confirme se não houve restrições de acesso, documentação, operação ou metodologia.
          </Alert>
        )}
      </section>

      <Card className="conclusion-card">
        <div className="section-heading">
          <div><h2>Conclusão do responsável técnico</h2><p>O sistema não produzirá declaração automática de segurança ou conformidade global.</p></div>
        </div>
        <AutosaveTextarea
          label="Conclusão revisada"
          required
          rows={8}
          value={inspection.conclusion}
          onSave={saveConclusion}
        />
      </Card>

      {nonBlocking && !blocking && (
        <label className="acknowledgement">
          <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
          <span>
            <strong>Estou ciente das pendências não bloqueantes.</strong>
            <small>Revisei os alertas e decidi prosseguir para a prévia do relatório.</small>
          </span>
        </label>
      )}

      <div className="sticky-actions sticky-actions--split">
        <Link className="button button--secondary" to={`/inspection/${inspection.id}/locations`}>
          Voltar ao campo
        </Link>
        <Button
          onClick={() => void continueToReport()}
          disabled={blocking || (nonBlocking && !acknowledged)}
          icon={blocking ? <AlertCircle size={19} /> : <ArrowRight size={19} />}
        >
          {blocking ? 'Corrigir pendências' : 'Abrir prévia'}
        </Button>
      </div>
    </div>
  )
}
