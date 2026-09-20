import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, CheckCircle2, Plus, ShieldAlert } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSaveState } from '../app/SaveContext'
import { AutosaveInput, AutosaveTextarea } from '../components/AutosaveField'
import { PhotoCapture } from '../components/PhotoCapture'
import { PhotoCard } from '../components/PhotoCard'
import { Alert, Button, Card, PageTitle, Pill, Skeleton } from '../components/ui'
import { db } from '../db/database'
import { mutateInspection } from '../db/repository'
import { createId, nowIso } from '../domain/ids'
import { findEquipment, findLocation } from '../domain/inspection'
import type { CriticalityLevel, InspectionPhoto, LibraryItem, NormativeReference } from '../domain/types'
import { InspectionHeader } from '../features/inspections/InspectionHeader'
import { useInspection } from '../features/inspections/useInspection'

type OccurrenceTextField =
  | 'title'
  | 'finding'
  | 'technicalDescription'
  | 'recommendation'
  | 'inspectorNote'

export function OccurrencePage() {
  const { inspectionId, occurrenceId } = useParams()
  const inspection = useInspection(inspectionId)
  const { runSave } = useSaveState()
  const navigate = useNavigate()
  const [selectedReferenceId, setSelectedReferenceId] = useState('')
  const library = useLiveQuery<LibraryItem[], LibraryItem[]>(
    () => db.libraryItems.filter((item) => item.active).toArray(),
    [],
    []
  )
  const photos = useLiveQuery<InspectionPhoto[], InspectionPhoto[]>(
    () =>
      inspectionId && occurrenceId
        ? db.photos.where('[inspectionId+occurrenceId]').equals([inspectionId, occurrenceId]).sortBy('order')
        : Promise.resolve([]),
    [inspectionId, occurrenceId],
    []
  )

  if (!inspection || !occurrenceId) return <Skeleton height={560} />
  const occurrence = inspection.occurrences.find((item) => item.id === occurrenceId)
  if (!occurrence) return <PageTitle title="Ocorrência não encontrada" />
  const location = findLocation(inspection, occurrence.locationId)
  const equipment = findEquipment(inspection, occurrence.locationId, occurrence.equipmentId)

  const criticalities = library.filter((item): item is CriticalityLevel => item.kind === 'criticality')
  const references = library.filter(
    (item): item is NormativeReference => item.kind === 'normative-reference'
  )
  const availableReferences = references.filter(
    (reference) =>
      reference.validatedByEngineer &&
      reference.standardId.trim() &&
      !occurrence.references.some((item) => item.sourceReferenceId === reference.id)
  )

  const saveText = (field: OccurrenceTextField) => async (value: string) => {
    await mutateInspection(inspection.id, (draft) => {
      const target = draft.occurrences.find((item) => item.id === occurrenceId)
      if (!target) throw new Error('Ocorrência não encontrada.')
      target[field] = value
      target.updatedAt = nowIso()
      target.requiresReview = true
    })
  }

  const confirmCriticality = async (criticalityId: string) => {
    const criticality = criticalities.find((item) => item.id === criticalityId)
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const target = draft.occurrences.find((item) => item.id === occurrenceId)
        if (!target) throw new Error('Ocorrência não encontrada.')
        target.confirmedCriticalityId = criticality?.id
        target.confirmedCriticalityLabel = criticality?.title
        target.criticalityConfirmedAt = criticality ? nowIso() : undefined
        target.requiresReview = true
      })
    )
  }

  const toggleReference = async (referenceId: string, confirmed: boolean) => {
    const reference = occurrence.references.find((item) => item.id === referenceId)
    const source = references.find((item) => item.id === reference?.sourceReferenceId)
    if (confirmed && (!source?.validatedByEngineer || !source.standardId.trim())) {
      window.alert('A referência precisa ser preenchida e validada na Biblioteca técnica antes da confirmação de aplicabilidade.')
      return
    }
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const target = draft.occurrences.find((item) => item.id === occurrenceId)
        const item = target?.references.find((entry) => entry.id === referenceId)
        if (!item) throw new Error('Referência não encontrada.')
        item.applicabilityConfirmed = confirmed
        item.confirmedAt = confirmed ? nowIso() : undefined
        if (target) target.requiresReview = true
      })
    )
  }

  const addReference = async () => {
    const reference = references.find((item) => item.id === selectedReferenceId)
    if (!reference?.validatedByEngineer || !reference.standardId.trim()) return
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const target = draft.occurrences.find((item) => item.id === occurrenceId)
        if (!target) throw new Error('Ocorrência não encontrada.')
        target.references.push({
          id: createId(),
          sourceReferenceId: reference.id,
          standardId: reference.standardId,
          standardTitle: reference.standardTitle,
          edition: reference.edition,
          clause: reference.clause,
          applicabilityConfirmed: false
        })
        target.requiresReview = true
      })
    )
    setSelectedReferenceId('')
  }

  const finishReview = async () => {
    await runSave(() =>
      mutateInspection(inspection.id, (draft) => {
        const target = draft.occurrences.find((item) => item.id === occurrenceId)
        if (target) target.requiresReview = false
      })
    )
    if (occurrence.origin === 'checklist' && occurrence.equipmentId) {
      navigate(
        `/inspection/${inspection.id}/location/${occurrence.locationId}/equipment/${occurrence.equipmentId}/checklist`
      )
    } else {
      navigate(`/inspection/${inspection.id}/locations`)
    }
  }

  return (
    <div>
      <InspectionHeader inspection={inspection} />
      <PageTitle
        eyebrow={`NC-${String(occurrence.internalNumber).padStart(3, '0')} • ${location?.name ?? 'Local não encontrado'}`}
        title={occurrence.title || 'Nova ocorrência'}
        description={`${equipment?.tag ?? 'Ocorrência geral'} • ${occurrence.origin === 'checklist' ? 'Originada pelo checklist' : 'Ocorrência livre'}`}
      />

      {occurrence.criterionText && (
        <Alert title="Critério que originou a ocorrência" tone="info">
          {occurrence.criterionText}
        </Alert>
      )}

      <Card className="form-card occurrence-form">
        <div className="form-section">
          <div className="section-heading">
            <div><h2>Constatação</h2><p>Descreva somente o que foi efetivamente observado.</p></div>
            {occurrence.requiresReview && <Pill tone="warning">Revisão pendente</Pill>}
          </div>
          <AutosaveInput label="Título do problema" required value={occurrence.title} onSave={saveText('title')} />
          <AutosaveTextarea
            label="Constatação observada"
            required
            value={occurrence.finding}
            onSave={saveText('finding')}
            hint="Evite inferir causas, riscos ou medições que não tenham sido comprovados."
          />
          <AutosaveTextarea
            label="Descrição técnica sugerida e editável"
            value={occurrence.technicalDescription}
            onSave={saveText('technicalDescription')}
          />
          <AutosaveTextarea
            label="Recomendação"
            required
            value={occurrence.recommendation}
            onSave={saveText('recommendation')}
          />
          <AutosaveTextarea
            label="Observação do inspetor"
            value={occurrence.inspectorNote}
            onSave={saveText('inspectorNote')}
          />
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div><h2>Criticidade</h2><p>A sugestão não é uma avaliação definitiva.</p></div>
          </div>
          {occurrence.suggestedCriticalityLabel && (
            <div className="suggestion-row">
              <ShieldAlert size={20} />
              <span>Sugestão da biblioteca</span>
              <strong>{occurrence.suggestedCriticalityLabel}</strong>
            </div>
          )}
          <label className="field">
            <span className="field__label">Criticidade confirmada pelo engenheiro</span>
            <select
              value={occurrence.confirmedCriticalityId ?? ''}
              onChange={(event) => void confirmCriticality(event.target.value)}
            >
              <option value="">Não confirmada</option>
              {criticalities.sort((a, b) => a.rank - b.rank).map((item) => (
                <option key={item.id} value={item.id}>{item.title}</option>
              ))}
            </select>
            <span className="field__hint">Selecionar uma opção registra a confirmação nesta ocorrência.</span>
          </label>
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div><h2>Referências normativas</h2><p>Confirme a aplicabilidade separadamente em cada ocorrência.</p></div>
          </div>
          {occurrence.references.length === 0 ? (
            <Alert title="Nenhuma referência sugerida" tone="info">
              O relatório permanecerá sem referência para esta ocorrência até que uma referência validada seja adicionada.
            </Alert>
          ) : (
            <div className="reference-list">
              {occurrence.references.map((reference) => {
                const source = references.find((item) => item.id === reference.sourceReferenceId)
                const canConfirm = Boolean(source?.validatedByEngineer && reference.standardId.trim())
                return (
                  <label className={`reference-row ${canConfirm ? '' : 'reference-row--pending'}`} key={reference.id}>
                    <input
                      type="checkbox"
                      checked={reference.applicabilityConfirmed}
                      disabled={!canConfirm}
                      onChange={(event) => void toggleReference(reference.id, event.target.checked)}
                    />
                    <span>
                      <strong>{reference.standardId || 'Referência a validar'}</strong>
                      <small>
                        {[reference.standardTitle, reference.edition, reference.clause].filter(Boolean).join(' • ') ||
                          'Registro interno sem identificação normativa confirmada.'}
                      </small>
                    </span>
                    <Pill tone={reference.applicabilityConfirmed ? 'success' : 'warning'}>
                      {reference.applicabilityConfirmed ? 'Aplicabilidade confirmada' : 'Pendente'}
                    </Pill>
                  </label>
                )
              })}
            </div>
          )}
          <div className="reference-add">
            <label className="field">
              <span className="field__label">Adicionar referência validada</span>
              <select value={selectedReferenceId} onChange={(event) => setSelectedReferenceId(event.target.value)}>
                <option value="">Selecione</option>
                {availableReferences.map((reference) => (
                  <option key={reference.id} value={reference.id}>
                    {reference.standardId} — {reference.standardTitle}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="secondary" onClick={() => void addReference()} disabled={!selectedReferenceId} icon={<Plus size={18} />}>
              Adicionar
            </Button>
          </div>
        </div>
      </Card>

      <section className="photo-section">
        <div className="section-heading">
          <div><h2>Registro fotográfico</h2><p>A imagem original é salva antes da otimização.</p></div>
          <Pill>{photos.length} foto(s)</Pill>
        </div>
        <PhotoCapture
          inspectionId={inspection.id}
          scope="occurrence"
          locationId={occurrence.locationId}
          equipmentId={occurrence.equipmentId}
          occurrenceId={occurrence.id}
        />
        <div className="photo-grid">
          {photos.map((photo, index) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              canMoveBack={index > 0}
              canMoveForward={index < photos.length - 1}
            />
          ))}
        </div>
      </section>

      <div className="sticky-actions sticky-actions--split">
        <Button variant="secondary" onClick={() => navigate(-1)} icon={<ArrowLeft size={18} />}>
          Voltar
        </Button>
        <Button onClick={() => void finishReview()} icon={<CheckCircle2 size={19} />}>
          Concluir revisão
        </Button>
      </div>
    </div>
  )
}
